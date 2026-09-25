package com.krovi.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class KroviMediaService extends Service {
    public static final String ACTION_START = "com.krovi.music.media.START";
    public static final String ACTION_UPDATE = "com.krovi.music.media.UPDATE";
    public static final String ACTION_PROGRESS = "com.krovi.music.media.PROGRESS";
    public static final String ACTION_STOP = "com.krovi.music.media.STOP";
    public static final String ACTION_PLAY_PAUSE = "com.krovi.music.media.PLAY_PAUSE";
    public static final String ACTION_PREVIOUS = "com.krovi.music.media.PREVIOUS";
    public static final String ACTION_NEXT = "com.krovi.music.media.NEXT";
    public static final String ACTION_COMMAND = "com.krovi.music.media.COMMAND";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_PLAYING = "playing";
    public static final String EXTRA_DURATION = "duration";
    public static final String EXTRA_POSITION = "position";
    public static final String EXTRA_ARTWORK = "artwork";
    public static final String EXTRA_COMMAND = "command";

    private static final int NOTIFICATION_ID = 61042;
    private static final String CHANNEL_ID = "krovi-playback";

    private static volatile boolean playbackActive = false;

    private MediaSession mediaSession;
    private PowerManager.WakeLock wakeLock;
    private final ExecutorService artworkExecutor = Executors.newSingleThreadExecutor();

    private String title = "Krovi Music";
    private String artist = "YouTube";
    private String artworkUrl = "";
    private Bitmap artworkBitmap;
    private double durationSeconds;
    private double positionSeconds;
    private boolean playing;

    public static boolean isPlaybackActive() {
        return playbackActive;
    }

    public static void update(
        Context context,
        String title,
        String artist,
        boolean playing,
        double duration,
        double position,
        String artwork
    ) {
        Intent intent = new Intent(context, KroviMediaService.class)
            .setAction(ACTION_UPDATE)
            .putExtra(EXTRA_TITLE, title)
            .putExtra(EXTRA_ARTIST, artist)
            .putExtra(EXTRA_PLAYING, playing)
            .putExtra(EXTRA_DURATION, duration)
            .putExtra(EXTRA_POSITION, position)
            .putExtra(EXTRA_ARTWORK, artwork);

        if (Build.VERSION.SDK_INT >= 26) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    // Backward-compatible bridge entry point for older web bundles.\n    public static void update(Context context, String title, String artist, boolean playing) {\n        update(context, title, artist, playing, 0, 0, "");\n    }\n\n    public static void updatePlayback(Context context, boolean playing, double duration, double position) {
        Intent intent = new Intent(context, KroviMediaService.class)
            .setAction(ACTION_PROGRESS)
            .putExtra(EXTRA_PLAYING, playing)
            .putExtra(EXTRA_DURATION, duration)
            .putExtra(EXTRA_POSITION, position);

        if (Build.VERSION.SDK_INT >= 26) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, KroviMediaService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        mediaSession = new MediaSession(this, "KroviMusic");
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                sendCommand("play");
            }

            @Override
            public void onPause() {
                sendCommand("pause");
            }

            @Override
            public void onSkipToPrevious() {
                sendCommand("previous");
            }

            @Override
            public void onSkipToNext() {
                sendCommand("next");
            }

            @Override
            public void onStop() {
                sendCommand("pause");
            }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;

        if (ACTION_STOP.equals(action)) {
            stopPlaybackService();
            return START_NOT_STICKY;
        }

        if (ACTION_PROGRESS.equals(action)) {
            playing = intent.getBooleanExtra(EXTRA_PLAYING, false);
            durationSeconds = Math.max(0, intent.getDoubleExtra(EXTRA_DURATION, 0));
            positionSeconds = Math.max(0, intent.getDoubleExtra(EXTRA_POSITION, 0));
            playbackActive = true;

            if (playing) ensureWakeLock();
            else releaseWakeLock();

            publishPlaybackState();
            startNotification();
            return START_STICKY;
        }

        if (ACTION_UPDATE.equals(action)) {
            String nextTitle = intent.getStringExtra(EXTRA_TITLE);
            String nextArtist = intent.getStringExtra(EXTRA_ARTIST);
            String nextArtwork = intent.getStringExtra(EXTRA_ARTWORK);

            if (nextTitle != null && !nextTitle.isBlank()) title = nextTitle;
            if (nextArtist != null && !nextArtist.isBlank()) artist = nextArtist;
            if (nextArtwork != null) artworkUrl = nextArtwork;

            playing = intent.getBooleanExtra(EXTRA_PLAYING, false);
            durationSeconds = Math.max(0, intent.getDoubleExtra(EXTRA_DURATION, 0));
            positionSeconds = Math.max(0, intent.getDoubleExtra(EXTRA_POSITION, 0));
            playbackActive = true;

            if (playing) ensureWakeLock();
            else releaseWakeLock();

            publishPlaybackState();
            startNotification();
            loadArtworkIfNeeded();
            return START_STICKY;
        }

        if (ACTION_PLAY_PAUSE.equals(action)) {
            playing = !playing;
            playbackActive = true;

            if (playing) ensureWakeLock();
            else releaseWakeLock();

            publishPlaybackState();
            startNotification();
            sendCommand(playing ? "play" : "pause");
            return START_STICKY;
        }

        if (ACTION_PREVIOUS.equals(action) || ACTION_NEXT.equals(action)) {
            sendCommand(ACTION_PREVIOUS.equals(action) ? "previous" : "next");
            return START_STICKY;
        }

        playing = true;
        playbackActive = true;
        ensureWakeLock();
        publishPlaybackState();
        startNotification();

        return START_STICKY;
    }

    private void sendCommand(String command) {
        Intent intent = new Intent(ACTION_COMMAND)
            .setPackage(getPackageName())
            .putExtra(EXTRA_COMMAND, command);
        sendBroadcast(intent);
    }

    private void startNotification() {
        Notification notification = buildNotification();

        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification() {
        Intent openApp = new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            61043,
            openApp,
            pendingIntentFlags()
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        builder
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title)
            .setContentText(artist)
            .setContentIntent(contentIntent)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setShowWhen(false)
            .setOnlyAlertOnce(true)
            .setStyle(
                new Notification.MediaStyle()
                    .setMediaSession(mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2)
            )
            .addAction(
                android.R.drawable.ic_media_previous,
                "Previous",
                servicePendingIntent(ACTION_PREVIOUS)
            )
            .addAction(
                playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                playing ? "Pause" : "Play",
                servicePendingIntent(ACTION_PLAY_PAUSE)
            )
            .addAction(
                android.R.drawable.ic_media_next,
                "Next",
                servicePendingIntent(ACTION_NEXT)
            );

        if (artworkBitmap != null) {
            builder.setLargeIcon(artworkBitmap);
        }

        return builder.build();
    }

    private void loadArtworkIfNeeded() {
        final String requestedUrl = artworkUrl;

        if (requestedUrl == null || requestedUrl.isBlank()) return;
        if (requestedUrl.equals(artworkUrl) && artworkBitmap != null) return;

        artworkExecutor.execute(() -> {
            Bitmap bitmap = null;

            try {
                HttpURLConnection connection = (HttpURLConnection) new URL(requestedUrl).openConnection();
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setInstanceFollowRedirects(true);

                try (InputStream input = connection.getInputStream()) {
                    bitmap = BitmapFactory.decodeStream(input);
                } finally {
                    connection.disconnect();
                }
            } catch (Exception ignored) {
                // Artwork is optional.
            }

            if (bitmap != null && requestedUrl.equals(artworkUrl)) {
                artworkBitmap = bitmap;
                startNotification();
            }
        });
    }

    private PendingIntent servicePendingIntent(String action) {\n        Intent intent = new Intent(this, KroviMediaService.class)\n            .setAction(action);\n\n        return PendingIntent.getService(\n            this,\n            action.hashCode(),\n            intent,\n            pendingIntentFlags()\n        );\n    }\n\n    private int pendingIntentFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return flags;
    }

    private void publishPlaybackState() {
        long actions =
            PlaybackState.ACTION_PLAY |
            PlaybackState.ACTION_PAUSE |
            PlaybackState.ACTION_PLAY_PAUSE |
            PlaybackState.ACTION_SKIP_TO_PREVIOUS |
            PlaybackState.ACTION_SKIP_TO_NEXT |
            PlaybackState.ACTION_SEEK_TO;

        long positionMs = Math.max(0L, Math.round(positionSeconds * 1000.0));

        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, "Krovi Music")
            .putLong(MediaMetadata.METADATA_KEY_DURATION, Math.max(0L, Math.round(durationSeconds * 1000.0)));

        if (artworkBitmap != null) {
            metadata.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, artworkBitmap);
            metadata.putBitmap(MediaMetadata.METADATA_KEY_ART, artworkBitmap);
        }

        mediaSession.setMetadata(metadata.build());

        mediaSession.setPlaybackState(
            new PlaybackState.Builder()
                .setActions(actions)
                .setState(
                    playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                    positionMs,
                    playing ? 1f : 0f,
                    SystemClock.elapsedRealtime()
                )
                .setBufferedPosition(positionMs)
                .build()
        );
    }

    private void stopPlaybackService() {
        playing = false;
        playbackActive = false;
        releaseWakeLock();

        if (mediaSession != null) {
            mediaSession.setActive(false);
        }

        if (Build.VERSION.SDK_INT >= 24) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }

        stopSelf();
    }

    private void ensureWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;

        PowerManager manager = (PowerManager) getSystemService(POWER_SERVICE);
        if (manager == null) return;

        wakeLock = manager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "KroviMusic:Playback"
        );
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire();
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        wakeLock = null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < 26) return;

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Krovi playback",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Playback controls for Krovi Music");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        if (playbackActive && playing) {
            ensureWakeLock();
            startNotification();
        }

        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        playbackActive = false;
        releaseWakeLock();
        artworkExecutor.shutdownNow();

        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }

        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
