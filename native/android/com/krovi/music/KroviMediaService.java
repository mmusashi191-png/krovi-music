package com.krovi.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;

public class KroviMediaService extends Service {
    public static final String ACTION_START = "com.krovi.music.media.START";
    public static final String ACTION_UPDATE = "com.krovi.music.media.UPDATE";
    public static final String ACTION_STOP = "com.krovi.music.media.STOP";
    public static final String ACTION_PLAY_PAUSE = "com.krovi.music.media.PLAY_PAUSE";
    public static final String ACTION_PREVIOUS = "com.krovi.music.media.PREVIOUS";
    public static final String ACTION_NEXT = "com.krovi.music.media.NEXT";
    public static final String ACTION_COMMAND = "com.krovi.music.media.COMMAND";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_COMMAND = "command";

    private static final int NOTIFICATION_ID = 61042;
    private static final String CHANNEL_ID = "krovi-playback";
    private MediaSession mediaSession;
    private String title = "Krovi Music";
    private String artist = "YouTube";
    private boolean playing = true;

    public static void start(Context context, String title, String artist) {
        Intent intent = new Intent(context, KroviMediaService.class)
            .setAction(ACTION_START)
            .putExtra(EXTRA_TITLE, title)
            .putExtra(EXTRA_ARTIST, artist);

        if (Build.VERSION.SDK_INT >= 26) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context) {
        context.startService(new Intent(context, KroviMediaService.class).setAction(ACTION_STOP));
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
            stopNotification();
            return START_NOT_STICKY;
        }

        if (intent != null) {
            String nextTitle = intent.getStringExtra(EXTRA_TITLE);
            String nextArtist = intent.getStringExtra(EXTRA_ARTIST);
            if (nextTitle != null && !nextTitle.isBlank()) title = nextTitle;
            if (nextArtist != null && !nextArtist.isBlank()) artist = nextArtist;
        }

        if (ACTION_PLAY_PAUSE.equals(action) || ACTION_PREVIOUS.equals(action) || ACTION_NEXT.equals(action)) {
            handleAction(action);
            return START_STICKY;
        }

        playing = true;
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
            .setOngoing(playing)
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

        return builder.build();
    }

    private PendingIntent servicePendingIntent(String action) {
        Intent intent = new Intent(this, KroviMediaService.class).setAction(action);
        return PendingIntent.getService(this, action.hashCode(), intent, pendingIntentFlags());
    }

    private int pendingIntentFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return flags;
    }

    private void handleAction(String action) {
        if (ACTION_PLAY_PAUSE.equals(action)) {
            sendCommand(playing ? "pause" : "play");
            return;
        }

        if (ACTION_PREVIOUS.equals(action)) {
            sendCommand("previous");
            return;
        }

        if (ACTION_NEXT.equals(action)) {
            sendCommand("next");
        }
    }

    private void publishPlaybackState() {
        long actions =
            PlaybackState.ACTION_PLAY |
            PlaybackState.ACTION_PAUSE |
            PlaybackState.ACTION_PLAY_PAUSE |
            PlaybackState.ACTION_SKIP_TO_PREVIOUS |
            PlaybackState.ACTION_SKIP_TO_NEXT;

        mediaSession.setMetadata(
            new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
                .putString(MediaMetadata.METADATA_KEY_ALBUM, "Krovi Music")
                .build()
        );

        mediaSession.setPlaybackState(
            new PlaybackState.Builder()
                .setActions(actions)
                .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, 0L, 1f)
                .build()
        );
    }

    private void stopNotification() {
        playing = false;
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
    public void onDestroy() {
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

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
    }
}
