package com.skywire.skycoin.vpn;;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.VpnService;
import android.os.Handler;
import android.os.Message;
import android.os.Messenger;
import android.os.ParcelFileDescriptor;
import android.support.v4.app.NotificationCompat;
import android.util.Pair;

import com.skywire.skycoin.vpn.helpers.App;
import com.skywire.skycoin.vpn.helpers.Globals;
import com.skywire.skycoin.vpn.helpers.HelperFunctions;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import io.reactivex.rxjava3.schedulers.Schedulers;
import skywiremob.Skywiremob;

public class SkywireVPNService extends VpnService implements Handler.Callback {
    public static class States {
        public static int STARTING = 10;
        public static int PREPARING_VISOR = 20;
        public static int PREPARING_VPN_CLIENT = 30;
        public static int FINAL_PREPARATIONS_FOR_VISOR = 35;
        public static int VISOR_READY = 40;
        public static int STARTING_VPN_CONNECTION = 50;
        public static int CONNECTED = 100;
        public static int DISCONNECTING = 200;
        public static int DISCONNECTED = 300;
        public static int ERROR = 400;
    }

    static int getTextForState(int state) {
        if (state == States.STARTING) {
            return R.string.vpn_state_initializing;
        } else if (state == States.PREPARING_VISOR) {
            return R.string.vpn_state_starting_visor;
        } else if (state == States.PREPARING_VPN_CLIENT) {
            return R.string.vpn_state_starting_vpn_app;
        } else if (state == States.FINAL_PREPARATIONS_FOR_VISOR) {
            return R.string.vpn_state_additional_visor_initializations;
        } else if (state == States.VISOR_READY) {
            return R.string.vpn_state_connecting;
        } else if (state == States.STARTING_VPN_CONNECTION) {
            return R.string.vpn_state_connecting;
        } else if (state == States.CONNECTED) {
            return R.string.vpn_state_connected;
        } else if (state == States.DISCONNECTING) {
            return R.string.vpn_state_disconnecting;
        } else if (state == States.DISCONNECTED) {
            return R.string.vpn_state_disconnected;
        }

        return -1;
    }

    public static final String ACTION_CONNECT = "com.skywire.android.vpn.START";
    public static final String ACTION_DISCONNECT = "com.skywire.android.vpn.STOP";
    public static final String ACTION_STOP_COMUNNICATION = "com.skywire.android.vpn.STOP_COMM";

    private HashMap<Integer, Messenger> messengers = new HashMap<>();

    private SkywireVPNConnection connectionRunnable;

    private static final String TAG = SkywireVPNService.class.getSimpleName();
    private Handler mHandler;
    private static class Connection extends Pair<Thread, ParcelFileDescriptor> {
        public Connection(Thread thread, ParcelFileDescriptor pfd) {
            super(thread, pfd);
        }
    }
    private final AtomicReference<Thread> mConnectingThread = new AtomicReference<>();
    private final AtomicReference<Connection> mConnection = new AtomicReference<>();
    private AtomicInteger mNextConnectionId = new AtomicInteger(1);
    private PendingIntent mConfigureIntent;

    private int currentState = States.STARTING;

    private VisorRunnable visor;

    @Override
    public void onCreate() {
        // The handler is only used to show messages.
        if (mHandler == null) {
            mHandler = new Handler(this);
        }

        // Create the intent to "configure" the connection (just start SkywireVPNClient).
        final Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);

        mConfigureIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private void updateState(int newState) {
        currentState = newState;

        Message msg = Message.obtain();
        msg.what = currentState;

        for(Map.Entry<Integer, Messenger> entry : messengers.entrySet()) {
            try {
                entry.getValue().send(msg);
            } catch (Exception e) {}
        }

        updateForegroundNotification();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_DISCONNECT.equals(intent.getAction())) {
            // TODO: there should be a dedicated var for knowing if the visor can be stoped, to avoid race conditions.
            if (visor != null) {
                Skywiremob.printString("STOPPING ANDROID VPN SERVICE");
                disconnect();
                updateState(States.DISCONNECTING);
                visor.stopVisor();
            }
            return START_NOT_STICKY;
        } else if (intent != null && ACTION_CONNECT.equals(intent.getAction())) {
            // TODO: make foreground one time only.

            // Become a foreground service. Background services can be VPN services too, but they can
            // be killed by background check before getting a chance to receive onRevoke().
            makeForeground();

            if (intent.hasExtra("ID") && intent.hasExtra("Messenger")) {
                messengers.put(intent.getIntExtra("ID", 0), intent.getParcelableExtra("Messenger"));

                Message msg = Message.obtain();
                msg.what = currentState;
                try {
                    ((Messenger)intent.getParcelableExtra("Messenger")).send(msg);
                } catch (Exception e) {}
            }

            if (visor == null) {
                Skywiremob.printString("STARTING ANDROID VPN SERVICE");

                visor = new VisorRunnable();

                visor.run()
                    .subscribeOn(Schedulers.io())
                    .subscribe(state -> {
                        updateState(state);

                        if (state == States.VISOR_READY) {
                            connect();
                        }
                    });
            }

            return START_STICKY;
        } else if (intent != null && ACTION_STOP_COMUNNICATION.equals(intent.getAction())) {
            if (intent.hasExtra("ID")) {
                messengers.remove(intent.getIntExtra("ID", 0));
            }
        } else {
            // TODO: manage the case.
        }

        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        disconnect();
    }

    @Override
    public boolean handleMessage(Message message) {
        if (message.what != R.string.disconnected) {
            //updateForegroundNotification(message.what);
        }
        return true;
    }

    private void connect() {
        mHandler.sendEmptyMessage(R.string.connecting);

        // Maybe this should be in another thread.
        try {
            while (!Skywiremob.isVPNReady()) {
                Skywiremob.printString("VPN STILL NOT READY, WAITING...");
                Thread.sleep(1000);
            }
        } catch (Exception e) {
            Skywiremob.printString(e.getMessage());
        }

        Skywiremob.printString("VPN IS READY, LET'S TRY IT OUT");

        startConnection(new SkywireVPNConnection(
                this, mNextConnectionId.getAndIncrement(), "localhost", 7890));
    }

    private void startConnection(final SkywireVPNConnection connection) {
        this.connectionRunnable = connection;
        // Replace any existing connecting thread with the  new one.
        final Thread thread = new Thread(connection, "SkywireVPNThread");
        setConnectingThread(thread);
        // Handler to mark as connected once onEstablish is called.
        connection.setConfigureIntent(mConfigureIntent);
        connection.setOnEstablishListener(tunInterface -> {
            mHandler.sendEmptyMessage(R.string.connected);
            mConnectingThread.compareAndSet(thread, null);
            setConnection(new Connection(thread, tunInterface));
        });
        thread.start();
    }

    private void setConnectingThread(final Thread thread) {
        final Thread oldThread = mConnectingThread.getAndSet(thread);
        if (oldThread != null) {
            oldThread.interrupt();
        }
    }

    private void setConnection(final Connection connection) {
        final Connection oldConnection = mConnection.getAndSet(connection);
        if (oldConnection != null) {
            try {
                oldConnection.first.interrupt();
                oldConnection.second.close();
            } catch (IOException e) {
                Skywiremob.printString(TAG + " Closing VPN interface " + e.getMessage());
            }
        }
    }
    private void disconnect() {
        mHandler.sendEmptyMessage(R.string.disconnected);
        connectionRunnable.Stop();
        setConnectingThread(null);
        setConnection(null);
        stopForeground(true);
    }

    private void updateForegroundNotification() {
        NotificationManager mNotificationManager = (NotificationManager) App.getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        mNotificationManager.notify(1, createUpdatedNotification());
    }

    private void makeForeground() {
        startForeground(1, createUpdatedNotification());
    }

    private Notification createUpdatedNotification() {
        return new NotificationCompat.Builder(this, Globals.NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_vpn)
            .setContentTitle(getString(R.string.general_app_name))
            .setContentText(getString(getTextForState(currentState)))
            .setContentIntent(mConfigureIntent)
            .setOnlyAlertOnce(true)
            .build();
    }
}
