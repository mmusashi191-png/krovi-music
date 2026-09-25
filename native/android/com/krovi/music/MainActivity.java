package com.krovi.music;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final int NOTIFICATION_PERMISSION_REQUEST = 61044;
    private WebView webView;
    private BroadcastReceiver mediaCommandReceiver;
    private boolean mediaBridgeAttached = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#24141C"));
        registerMediaCommandReceiver();
        attachMediaBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        attachMediaBridge();

        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    public void onPause() {
        super.onPause();

        if (KroviMediaService.isPlaybackActive() && webView != null) {
            webView.post(() -> {
                if (KroviMediaService.isPlaybackActive()) {
                    webView.onResume();
                    webView.resumeTimers();
                }
            });
        }
    }

    @Override
    public void onStop() {
        super.onStop();

        if (KroviMediaService.isPlaybackActive() && webView != null) {
            webView.post(() -> {
                if (KroviMediaService.isPlaybackActive()) {
                    webView.onResume();
                    webView.resumeTimers();
                }
            });
        }
    }

    private void attachMediaBridge() {
        if (mediaBridgeAttached) return;

        webView = getBridge().getWebView();
        if (webView == null) return;

        WebSettings settings = webView.getSettings();
        settings.setMediaPlaybackRequiresUserGesture(false);

        if (Build.VERSION.SDK_INT >= 26) {
            webView.setRendererPriorityPolicy(
                WebView.RENDERER_PRIORITY_IMPORTANT,
                true
            );
        }

        webView.addJavascriptInterface(
            new KroviMediaJsBridge(this),
            "KroviMedia"
        );
        mediaBridgeAttached = true;
    }

    private void registerMediaCommandReceiver() {
        mediaCommandReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String command = intent.getStringExtra(KroviMediaService.EXTRA_COMMAND);
                if (command == null || command.isBlank()) return;
                dispatchMediaCommand(command);
            }
        };

        IntentFilter filter = new IntentFilter(KroviMediaService.ACTION_COMMAND);

        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(mediaCommandReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(mediaCommandReceiver, filter);
        }
    }

    private void dispatchMediaCommand(String command) {
        if (webView == null) {
            attachMediaBridge();
        }
        if (webView == null) return;

        final String safeCommand = JSONObject.quote(command);
        webView.post(() -> webView.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('krovi-native-media-command',{detail:{command:" +
            safeCommand +
            "}}));",
            null
        ));
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33) return;
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        requestPermissions(
            new String[] { Manifest.permission.POST_NOTIFICATIONS },
            NOTIFICATION_PERMISSION_REQUEST
        );
    }

    @Override
    public void onDestroy() {
        if (mediaCommandReceiver != null) {
            unregisterReceiver(mediaCommandReceiver);
            mediaCommandReceiver = null;
        }

        webView = null;
        mediaBridgeAttached = false;
        super.onDestroy();
    }

    private static final class KroviMediaJsBridge {
        private final MainActivity activity;

        KroviMediaJsBridge(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void update(String title, String artist, boolean playing) {
            KroviMediaService.update(activity, title, artist, playing);
        }

        @JavascriptInterface
        public void stop() {
            KroviMediaService.stop(activity);
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            activity.runOnUiThread(activity::requestNotificationPermission);
        }
    }
}
