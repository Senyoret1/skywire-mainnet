package com.skywire.skycoin.vpn.vpn;

import android.content.SharedPreferences;

import androidx.preference.PreferenceManager;

import com.skywire.skycoin.vpn.App;
import com.skywire.skycoin.vpn.Globals;

import java.util.HashSet;

/**
 * Helper class for saving and getting data related to the VPN service to and from the
 * persistent storage.
 */
public class VPNPersistentData {
    // Keys for persistent storage.
    private static final String SERVER_PK = "serverPK";
    private static final String SERVER_PASSWORD = "serverPass";
    private static final String LAST_ERROR = "lastError";
    private static final String APPS_SELECTION_MODE = "appsMode";
    private static final String APPS_LIST = "appsList";
    private static final String KILL_SWITCH = "killSwitch";
    private static final String RESTART_VPN = "restartVpn";
    private static final String START_ON_BOOT = "startOnBoot";
    private static final String PROTECT_BEFORE_CONNECTED = "protectBeforeConnected";

    private static final SharedPreferences settings = PreferenceManager.getDefaultSharedPreferences(App.getContext());

    /////////////////////////////////////////////////////////////
    // Setters.
    /////////////////////////////////////////////////////////////

    /**
     * Saves the public key and password of the visor to which all future connections must be made.
     */
    public static void setPublicKeyAndPassword(String pk, String password) {
        settings
            .edit()
            .putString(SERVER_PK, pk)
            .putString(SERVER_PASSWORD, password)
            .apply();
    }

    /**
     * Saves the message of the error which caused the VPN service to fail the last time it
     * ran, if any.
     */
    public static void setLastError(String val) {
        settings.edit().putString(LAST_ERROR, val).apply();
    }

    /**
     * Saves the mode the VPN service must use to protect or ignore the apps selected by the user.
     */
    public static void setAppsSelectionMode(Globals.AppFilteringModes val) {
        settings.edit().putString(APPS_SELECTION_MODE, val.toString()).apply();
    }

    /**
     * Saves the list with the package names of all apps selected by the user in the app list.
     */
    public static void setAppList(HashSet<String> val) {
        settings.edit().putStringSet(APPS_LIST, val).apply();
    }

    /**
     * Sets if the kill switch functionality must be active.
     */
    public static void setKillSwitchActivated(boolean val) {
        settings.edit().putBoolean(KILL_SWITCH, val).apply();
    }

    /**
     * Sets if the VPN connection must be automatically restarted if there is an error.
     */
    public static void setMustRestartVpn(boolean val) {
        settings.edit().putBoolean(RESTART_VPN, val).apply();
    }

    /**
     * Sets if the VPN protection must be activated as soon as possible after booting the OS.
     */
    public static void setStartOnBoot(boolean val) {
        settings.edit().putBoolean(START_ON_BOOT, val).apply();
    }

    /**
     * Sets if the network protection must be activated just after starting the VPN service, which
     * would disable the internet connectivity for the rest of the apps while configuring the visor.
     */
    public static void setProtectBeforeConnected(boolean val) {
        settings.edit().putBoolean(PROTECT_BEFORE_CONNECTED, val).apply();
    }

    /////////////////////////////////////////////////////////////
    // Getters.
    /////////////////////////////////////////////////////////////

    /**
     * Gets the public key of the visor to which all future connections must be made.
     * @param defaultValue Value to return if no saved data is found.
     */
    public static String getPublicKey(String defaultValue) {
        return settings.getString(SERVER_PK, defaultValue);
    }

    /**
     * Gets the password of the visor to which all future connections must be made.
     * @param defaultValue Value to return if no saved data is found.
     */
    public static String getPassword(String defaultValue) {
        return settings.getString(SERVER_PASSWORD, defaultValue);
    }

    /**
     * Gets the message of the error which caused the VPN service to fail the last time it
     * ran, if any.
     * @param defaultValue Value to return if no saved data is found.
     */
    public static String getLastError(String defaultValue) {
        return settings.getString(LAST_ERROR, defaultValue);
    }

    /**
     * Gets the mode the VPN service must use to protect or ignore the apps selected by the user.
     */
    public static Globals.AppFilteringModes getAppsSelectionMode() {
        String savedValue = settings.getString(APPS_SELECTION_MODE, null);

        if (savedValue == null || savedValue.equals(Globals.AppFilteringModes.PROTECT_ALL.toString())) {
            return Globals.AppFilteringModes.PROTECT_ALL;
        } else if (savedValue.equals(Globals.AppFilteringModes.PROTECT_SELECTED.toString())) {
            return Globals.AppFilteringModes.PROTECT_SELECTED;
        } else if (savedValue.equals(Globals.AppFilteringModes.IGNORE_SELECTED.toString())) {
            return Globals.AppFilteringModes.IGNORE_SELECTED;
        }

        return Globals.AppFilteringModes.PROTECT_ALL;
    }

    /**
     * Gets the list with the package names of all apps selected by the user in the app list.
     * @param defaultValue Value to return if no saved data is found.
     */
    public static HashSet<String> getAppList(HashSet<String> defaultValue) {
        return new HashSet<>(settings.getStringSet(APPS_LIST, defaultValue));
    }

    /**
     * Gets if the kill switch functionality must be active.
     */
    public static boolean getKillSwitchActivated() {
        return settings.getBoolean(KILL_SWITCH, true);
    }

    /**
     * Gets if the VPN connection must be automatically restarted if there is an error.
     */
    public static boolean getMustRestartVpn() {
        return settings.getBoolean(RESTART_VPN, true);
    }

    /**
     * Gets if the VPN protection must be activated as soon as possible after booting the OS.
     */
    public static boolean getStartOnBoot() {
        return settings.getBoolean(START_ON_BOOT, false);
    }

    /**
     * Gets if the network protection must be activated just after starting the VPN service, which
     * would disable the internet connectivity for the rest of the apps while configuring the visor.
     */
    public static boolean getProtectBeforeConnected() {
        return settings.getBoolean(PROTECT_BEFORE_CONNECTED, true);
    }

    /////////////////////////////////////////////////////////////
    // Other operations.
    /////////////////////////////////////////////////////////////

    /**
     * Removes the message of the error which caused the VPN service to fail the last time it ran.
     */
    public static void removeLastError() {
        settings.edit().remove(LAST_ERROR).apply();
    }
}
