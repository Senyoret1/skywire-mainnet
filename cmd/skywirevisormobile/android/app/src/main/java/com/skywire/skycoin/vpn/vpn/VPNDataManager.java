package com.skywire.skycoin.vpn.vpn;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InterruptedIOException;
import java.nio.ByteBuffer;
import java.nio.channels.DatagramChannel;

import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.ObservableOnSubscribe;

public class VPNDataManager {
    static public Observable<Integer> createObservable(VPNWorkInterface vpnInterface, DatagramChannel tunnel, boolean forSending) {
        return Observable.create((ObservableOnSubscribe<Integer>) emitter -> {
            // Packets to be sent are queued in this input stream.
            FileInputStream inStream = null;
            // Packets received need to be written to this output stream.
            FileOutputStream outStream = null;
            if (forSending) {
                inStream = vpnInterface.getInputStream();
            } else {
                outStream = vpnInterface.getOutputStream();
            }
            final FileInputStream in = inStream;
            final FileOutputStream out = outStream;

            ByteBuffer packet = ByteBuffer.allocate(Short.MAX_VALUE);

            int retries = 0;

            while(retries < 10) {
                try {
                    while (!emitter.isDisposed()) {
                        if (forSending) {
                            // Read the outgoing packet from the input stream.
                            int length = in.read(packet.array());
                            if (length > 0) {
                                // Write the outgoing packet to the tunnel.
                                packet.limit(length);
                                tunnel.write(packet);
                                packet.clear();
                            }
                        }

                        if (!forSending) {
                            int length = tunnel.read(packet);
                            if (length > 0) {
                                // Ignore control messages, which start with zero.
                                if (packet.get(0) != 0) {
                                    // Write the incoming packet to the output stream.
                                    out.write(packet.array(), 0, length);
                                }
                                packet.clear();
                            }
                        }

                        retries = 0;
                    }
                } catch (InterruptedIOException e) {
                    retries += 1 ;
                } catch (Exception e) {
                    if (!emitter.isDisposed()) {
                        emitter.onError(e);
                        return;
                    }

                    break;
                }
            }

            emitter.onComplete();
        });
    }
}
