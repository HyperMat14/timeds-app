import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemePreference } from '@/hooks/theme-context';

type ScheduledDose = {
  id: string;
  minuteOfDay: number;
};

const initialSchedule: ScheduledDose[] = [{ id: 'example-dose', minuteOfDay: 8 * 60 }];
const clockBellSound = require('../../assets/audio/clock-bell.wav');

function formatDoseTime(minuteOfDay: number) {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  const period = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 || 12;

  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

function parseDoseTime(value: string) {
  const digits = value.trim();
  if (!/^\d{1,4}$/.test(digits)) {
    return null;
  }

  const hour = Number(digits.length <= 2 ? digits : digits.slice(0, -2));
  const minute = digits.length <= 2 ? 0 : Number(digits.slice(-2));
  if (hour > 23 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

function getNextDose(schedule: ScheduledDose[], now: Date) {
  let nextDose: { dose: ScheduledDose; date: Date } | null = null;

  for (const dose of schedule) {
    const date = new Date(now);
    date.setHours(Math.floor(dose.minuteOfDay / 60), dose.minuteOfDay % 60, 0, 0);
    if (date <= now) {
      date.setDate(date.getDate() + 1);
    }

    if (!nextDose || date < nextDose.date) {
      nextDose = { dose, date };
    }
  }

  return nextDose;
}

function formatTimeRemaining(milliseconds: number) {
  const totalMinutes = Math.ceil(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `in ${minutes} min`;
  }
  if (minutes === 0) {
    return `in ${hours} hr`;
  }
  return `in ${hours} hr ${minutes} min`;
}

export default function HomeScreen() {
  const { colorScheme, error: themeError, isLoaded: themeReady, setPreference } =
    useThemePreference();
  const [audioError, setAudioError] = useState('');
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  const [schedule, setSchedule] = useState(initialSchedule);
  const [timeInput, setTimeInput] = useState('');
  const [timeError, setTimeError] = useState('');
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [showNotificationOptions, setShowNotificationOptions] = useState(false);
  const [simulatedDoseTime, setSimulatedDoseTime] = useState<Date | null>(null);
  const [isTestReminder, setIsTestReminder] = useState(false);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const firedDoseReminders = useRef(new Map<string, string>());
  const isDarkMode = colorScheme === 'dark';
  const palette = isDarkMode ? darkPalette : lightPalette;
  const styles = useMemo(() => createStyles(palette), [palette]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppIsActive(state === 'active');
      if (state === 'active') {
        setNow(new Date());
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!simulatedDoseTime || !appIsActive) {
      return;
    }

    let isCancelled = false;
    setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
    })
      .then(() => {
        if (isCancelled) {
          return;
        }

        const player = createAudioPlayer(clockBellSound);
        playerRef.current = player;
        player.loop = true;
        player.volume = 0.55;
        player.play();
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setAudioError(
            `Could not play the clock-bell alarm: ${
              error instanceof Error ? error.message : 'An unexpected error occurred.'
            }`,
          );
        }
      });

    return () => {
      isCancelled = true;
      const player = playerRef.current;
      if (player) {
        player.pause();
        player.release();
        playerRef.current = null;
      }
    };
  }, [appIsActive, simulatedDoseTime]);

  useEffect(() => {
    if (!appIsActive || simulatedDoseTime) {
      return;
    }

    const minuteOfDay = now.getHours() * 60 + now.getMinutes();
    const dueDose = schedule.find((dose) => dose.minuteOfDay === minuteOfDay);
    if (!dueDose) {
      return;
    }

    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    if (firedDoseReminders.current.get(dueDose.id) === dateKey) {
      return;
    }

    firedDoseReminders.current.set(dueDose.id, dateKey);
    setIsTestReminder(false);
    setSimulatedDoseTime(new Date(now));
  }, [appIsActive, now, schedule, simulatedDoseTime]);

  const nextDose = getNextDose(schedule, now);
  const sortedSchedule = [...schedule].sort((a, b) => a.minuteOfDay - b.minuteOfDay);

  async function setDarkMode(enabled: boolean) {
    await setPreference(enabled ? 'dark' : 'light');
  }

  function addDose() {
    const minuteOfDay = parseDoseTime(timeInput);
    if (minuteOfDay === null) {
      setTimeError('Enter an hour from 0 to 23, like 8 or 15. For minutes, enter 800 or 1530.');
      return;
    }
    if (schedule.some((dose) => dose.minuteOfDay === minuteOfDay)) {
      setTimeError('That time is already on your schedule.');
      return;
    }

    setSchedule((current) => [...current, { id: String(Date.now()), minuteOfDay }]);
    setTimeInput('');
    setTimeError('');
    setShowTimeForm(false);
  }

  function removeDose(doseToRemove: ScheduledDose) {
    setSchedule((current) => current.filter((dose) => dose.id !== doseToRemove.id));
  }

  function showConnectionInfo() {
    Alert.alert(
      'Dispenser not connected',
      'The gray light means no dispenser is connected. This prototype is showing a simulated status; Bluetooth is not set up yet.',
    );
  }

  function resetApp() {
    setSchedule([...initialSchedule]);
    setTimeInput('');
    setTimeError('');
    setShowTimeForm(false);
    setShowNotificationOptions(false);
    setSimulatedDoseTime(null);
    setIsTestReminder(false);
    setShowSettings(false);
  }

  function confirmResetApp() {
    Alert.alert(
      'Reset app?',
      'Restore the example 8:00 AM schedule and close any active reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetApp },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dispenser not connected. Tap for information."
            onPress={showConnectionInfo}
            style={({ pressed }) => [styles.connectionButton, pressed && styles.connectionPressed]}>
            <View style={styles.statusLight} />
          </Pressable>
          <Text style={styles.brand}>TiMeds</Text>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.body}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {themeError || audioError ? (
            <View accessibilityRole="alert" style={styles.errorBanner}>
              {themeError ? <Text style={styles.errorText}>{themeError}</Text> : null}
              {audioError ? <Text style={styles.errorText}>{audioError}</Text> : null}
            </View>
          ) : null}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>NEXT SCHEDULED DOSE</Text>
            {nextDose ? (
              <>
                <Text style={styles.time}>{formatDoseTime(nextDose.dose.minuteOfDay)}</Text>
                <Text style={styles.cardDescription}>
                  {formatTimeRemaining(nextDose.date.getTime() - now.getTime())}
                </Text>
                {audioError ? <Text style={styles.errorText}>{audioError}</Text> : null}
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>No doses scheduled</Text>
                <Text style={styles.cardDescription}>Add a dose time to see what’s next.</Text>
              </>
            )}
          </View>

          <View style={styles.scheduleSection}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Daily schedule</Text>
              <Text style={styles.doseCount}>
                {schedule.length} {schedule.length === 1 ? 'time' : 'times'}
              </Text>
            </View>

            {sortedSchedule.length > 0 ? (
              <View style={styles.doseList}>
                {sortedSchedule.map((dose) => (
                  <View key={dose.id} style={styles.doseRow}>
                    <View style={styles.doseMarker} />
                    <Text style={styles.doseTime}>{formatDoseTime(dose.minuteOfDay)}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${formatDoseTime(dose.minuteOfDay)} dose`}
                      onPress={() => removeDose(dose)}
                      style={({ pressed }) => [
                        styles.removeButton,
                        pressed && styles.removeButtonPressed,
                      ]}>
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptySchedule}>Your schedule is empty.</Text>
            )}

            {showTimeForm ? (
              <View style={styles.addForm}>
                <Text style={styles.inputLabel}>Enter a time using numbers</Text>
                <Text style={styles.inputHint}>For example, 8 = 8:00 AM and 15 = 3:00 PM.</Text>
                <TextInput
                  accessibilityLabel="Dose time in numbers"
                  autoCorrect={false}
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={(value) => {
                    setTimeInput(value.replace(/\D/g, ''));
                    setTimeError('');
                  }}
                  onSubmitEditing={addDose}
                  placeholder="e.g. 8 or 15"
                  placeholderTextColor={palette.inputMuted}
                  returnKeyType="done"
                  style={styles.timeInput}
                  value={timeInput}
                />
                {timeError ? <Text style={styles.errorText}>{timeError}</Text> : null}
                <View style={styles.formActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setShowTimeForm(false);
                      setTimeError('');
                    }}
                    style={({ pressed }) => [
                      styles.cancelButton,
                      pressed && styles.cancelButtonPressed,
                    ]}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={addDose}
                    style={({ pressed }) => [
                      styles.saveButton,
                      pressed && styles.saveButtonPressed,
                    ]}>
                    <Text style={styles.saveButtonText}>Save time</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowTimeForm(true)}
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.addButtonPressed,
                ]}>
                <Text style={styles.addButtonText}>+ Add a dose time</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowSettings(true)}
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && styles.settingsButtonPressed,
            ]}>
            <Text style={styles.settingsButtonText}>Settings</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (simulatedDoseTime && !isTestReminder) {
            return;
          }
          setShowNotificationOptions(false);
          setShowSettings(false);
          setSimulatedDoseTime(null);
          setIsTestReminder(false);
        }}
        transparent
        visible={showSettings || simulatedDoseTime !== null}>
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel={simulatedDoseTime ? 'Close dose reminder' : 'Close settings'}
            onPress={() => {
              if (simulatedDoseTime && !isTestReminder) {
                return;
              }
              setShowNotificationOptions(false);
              setShowSettings(false);
              setSimulatedDoseTime(null);
              setIsTestReminder(false);
            }}
            style={styles.modalBackdrop}
          />
          {simulatedDoseTime ? (
            <View accessibilityRole="alert" style={styles.reminderCard}>
              <Text style={styles.reminderEyebrow}>
                {isTestReminder ? 'TEST REMINDER' : 'DOSE REMINDER'}
              </Text>
              <Text style={styles.reminderTitle}>It’s time for your scheduled dose</Text>
              <Text style={styles.reminderTime}>
                {formatDoseTime(
                  simulatedDoseTime.getHours() * 60 + simulatedDoseTime.getMinutes(),
                )}
              </Text>
              <Text style={styles.modalDescription}>
                {isTestReminder
                  ? 'This is a sound preview. Dismissing it does not confirm that medication was taken.'
                  : 'Dismiss the bell when you have noticed this reminder. Dismissing it does not confirm that medication was taken.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSimulatedDoseTime(null);
                  setIsTestReminder(false);
                  setShowSettings(false);
                }}
                style={({ pressed }) => [
                  styles.closeSettingsButton,
                  pressed && styles.closeSettingsButtonPressed,
                ]}>
                <Text style={styles.closeSettingsButtonText}>
                  {isTestReminder ? 'Dismiss sound preview' : 'Dismiss alarm'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.settingsCard}>
                <Text style={styles.modalTitle}>Settings</Text>
                <Text style={styles.modalDescription}>
                  Manage the app appearance and reminder alert behavior.
                </Text>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowNotificationOptions(true)}
                  style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}>
                  <View style={styles.settingRowText}>
                    <Text style={styles.settingTitle}>Notification type</Text>
                    <Text style={styles.settingSubtitle}>Choose an alert style</Text>
                  </View>
                  <Text style={styles.settingArrow}>›</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={confirmResetApp}
                  style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}>
                  <View style={styles.settingRowText}>
                    <Text style={styles.settingTitle}>Reset app</Text>
                    <Text style={styles.settingSubtitle}>Restore the example schedule</Text>
                  </View>
                  <Text style={styles.settingArrow}>›</Text>
                </Pressable>

                <View style={styles.settingRow}>
                  <View style={styles.settingRowText}>
                    <Text style={styles.settingTitle}>Dark mode</Text>
                    <Text style={styles.settingSubtitle}>
                      {isDarkMode ? 'On' : 'Off'}
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel="Dark mode"
                    disabled={!themeReady}
                    onValueChange={(enabled) => void setDarkMode(enabled)}
                    trackColor={{ false: palette.switchTrack, true: palette.accent }}
                    thumbColor={palette.switchThumb}
                    value={isDarkMode}
                  />
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setIsTestReminder(true);
                    setSimulatedDoseTime(new Date());
                  }}
                  style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}>
                  <View style={styles.settingRowText}>
                    <Text style={styles.settingTitle}>Test dose reminder</Text>
                    <Text style={styles.settingSubtitle}>Preview the clock-bell sound</Text>
                  </View>
                  <Text style={styles.settingArrow}>›</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowSettings(false)}
                  style={({ pressed }) => [
                    styles.closeSettingsButton,
                    pressed && styles.closeSettingsButtonPressed,
                  ]}>
                  <Text style={styles.closeSettingsButtonText}>Done</Text>
                </Pressable>
              </View>

              {showNotificationOptions && (
                <View style={styles.submodalLayer}>
                  <Pressable
                    accessibilityLabel="Close notification options"
                    onPress={() => setShowNotificationOptions(false)}
                    style={styles.submodalBackdrop}
                  />
                  <View style={styles.notificationCard}>
                    <Text style={styles.modalTitle}>Notification type</Text>
                    <Text style={styles.modalDescription}>
                      The clock-bell sound plays while TiMeds is open. It stops when you dismiss
                      the alert and pauses when the app is in the background.
                    </Text>
                    <View style={styles.notificationOption}>
                      <Text style={styles.settingTitle}>Sound</Text>
                      <Text style={styles.settingSubtitle}>Soft, repeating tabletop clock bell</Text>
                    </View>
                    <View style={styles.notificationOption}>
                      <Text style={styles.settingTitle}>Vibration</Text>
                      <Text style={styles.settingSubtitle}>Not enabled in this prototype</Text>
                    </View>
                    <View style={styles.notificationOption}>
                      <Text style={styles.settingTitle}>On-screen alert</Text>
                      <Text style={styles.settingSubtitle}>
                        Rings at a scheduled time while the app is open.
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setShowNotificationOptions(false)}
                      style={({ pressed }) => [
                        styles.closeSettingsButton,
                        pressed && styles.closeSettingsButtonPressed,
                      ]}>
                      <Text style={styles.closeSettingsButtonText}>Back to settings</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const lightPalette = {
  screen: '#F6F4EF',
  header: '#551606',
  surface: '#FFFFFF',
  surfaceAlt: '#F6F4EF',
  input: '#F8F7F3',
  text: '#303A33',
  heading: '#551606',
  muted: '#626B64',
  helper: '#4C554F',
  accent: '#551606',
  accentPressed: '#3D1004',
  accentText: '#743727',
  marker: '#8B3F29',
  border: '#E8E4DA',
  borderStrong: '#8B5144',
  divider: '#EEEAE2',
  inputBorder: '#D8D6CD',
  inputMuted: '#7A817B',
  softAccent: '#F6ECE8',
  softAccentPressed: '#F5E9E5',
  lowBorder: '#B9BDB8',
  neutralPressed: '#F0EFEA',
  neutralText: '#475149',
  error: '#9B4037',
  errorSurface: '#FCE9E6',
  status: '#858B85',
  statusBorder: '#FFFFFF',
  shadow: '#000000',
  switchTrack: '#B9BDB8',
  switchThumb: '#FFFFFF',
} as const;

type AppPalette = { [Key in keyof typeof lightPalette]: string };

const darkPalette: AppPalette = {
  screen: '#181512',
  header: '#32140C',
  surface: '#28231F',
  surfaceAlt: '#211D1A',
  input: '#302923',
  text: '#EAE5DC',
  heading: '#E5B099',
  muted: '#B6AFA4',
  helper: '#C6BDB2',
  accent: '#94543D',
  accentPressed: '#74402D',
  accentText: '#E0A48A',
  marker: '#CB8A6E',
  border: '#453A32',
  borderStrong: '#8C5D4C',
  divider: '#3C342E',
  inputBorder: '#62554B',
  inputMuted: '#9D9489',
  softAccent: '#3D2B24',
  softAccentPressed: '#4A3229',
  lowBorder: '#62574E',
  neutralPressed: '#38312B',
  neutralText: '#D6CEC3',
  error: '#FF9B8F',
  errorSurface: '#472722',
  status: '#89958C',
  statusBorder: '#3C3833',
  shadow: '#000000',
  switchTrack: '#64574C',
  switchThumb: '#F2ECE4',
};

function createStyles(palette: AppPalette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: palette.screen,
    },
    headerSafeArea: {
      backgroundColor: palette.header,
    },
    body: {
      backgroundColor: palette.screen,
      flex: 1,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 20,
    },
    header: {
      alignItems: 'center',
      height: 76,
      justifyContent: 'center',
    },
    connectionButton: {
      alignItems: 'center',
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      left: 8,
      position: 'absolute',
      width: 56,
    },
    connectionPressed: {
      backgroundColor: palette.surfaceAlt,
    },
    statusLight: {
      backgroundColor: palette.status,
      borderColor: palette.statusBorder,
      borderRadius: 11,
      borderWidth: 3,
      elevation: 3,
      height: 22,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 3,
      width: 22,
    },
    brand: {
      color: '#FFFFFF',
      fontSize: 34,
      fontWeight: '700',
      letterSpacing: 0.3,
      textAlign: 'center',
    },
    card: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: 18,
      borderWidth: 1,
      padding: 24,
    },
    sectionLabel: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    time: {
      color: palette.heading,
      fontSize: 48,
      fontWeight: '700',
      marginTop: 12,
    },
    cardDescription: {
      color: palette.muted,
      fontSize: 17,
      marginTop: 4,
    },
    emptyTitle: {
      color: palette.heading,
      fontSize: 25,
      fontWeight: '700',
      marginTop: 14,
    },
    scheduleSection: {
      marginTop: 28,
    },
    sectionHeading: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: {
      color: palette.heading,
      fontSize: 21,
      fontWeight: '700',
    },
    doseCount: {
      color: palette.muted,
      fontSize: 15,
    },
    doseList: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: 16,
      borderWidth: 1,
      overflow: 'hidden',
    },
    doseRow: {
      alignItems: 'center',
      borderBottomColor: palette.divider,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      minHeight: 66,
      paddingHorizontal: 16,
    },
    doseMarker: {
      backgroundColor: palette.marker,
      borderRadius: 4,
      height: 8,
      marginRight: 14,
      width: 8,
    },
    doseTime: {
      color: palette.text,
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
    },
    removeButton: {
      alignItems: 'center',
      borderRadius: 8,
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 72,
      paddingHorizontal: 8,
    },
    removeButtonPressed: {
      backgroundColor: palette.softAccentPressed,
    },
    removeButtonText: {
      color: palette.accentText,
      fontSize: 15,
      fontWeight: '600',
    },
    emptySchedule: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: 14,
      borderWidth: 1,
      color: palette.muted,
      fontSize: 16,
      padding: 18,
    },
    addForm: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: 16,
      borderWidth: 1,
      marginTop: 12,
      padding: 18,
    },
    inputLabel: {
      color: palette.text,
      fontSize: 16,
      fontWeight: '600',
    },
    inputHint: {
      color: palette.muted,
      fontSize: 15,
      lineHeight: 21,
      marginBottom: 10,
      marginTop: 4,
    },
    timeInput: {
      backgroundColor: palette.input,
      borderColor: palette.inputBorder,
      borderRadius: 10,
      borderWidth: 1,
      color: palette.heading,
      fontSize: 18,
      minHeight: 52,
      paddingHorizontal: 14,
    },
    errorBanner: {
      backgroundColor: palette.errorSurface,
      borderColor: palette.error,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 14,
      padding: 14,
    },
    errorText: {
      color: palette.error,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 2,
    },
    formActions: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'flex-end',
      marginTop: 14,
    },
    cancelButton: {
      alignItems: 'center',
      borderColor: palette.lowBorder,
      borderRadius: 10,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 48,
      minWidth: 92,
      paddingHorizontal: 14,
    },
    cancelButtonPressed: {
      backgroundColor: palette.neutralPressed,
    },
    cancelButtonText: {
      color: palette.neutralText,
      fontSize: 16,
      fontWeight: '600',
    },
    saveButton: {
      alignItems: 'center',
      backgroundColor: palette.accent,
      borderRadius: 10,
      justifyContent: 'center',
      minHeight: 48,
      minWidth: 108,
      paddingHorizontal: 16,
    },
    saveButtonPressed: {
      backgroundColor: palette.accentPressed,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    addButton: {
      alignItems: 'center',
      borderColor: palette.borderStrong,
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: 'center',
      marginTop: 12,
      minHeight: 54,
      paddingHorizontal: 16,
    },
    addButtonPressed: {
      backgroundColor: palette.softAccent,
    },
    addButtonText: {
      color: palette.heading,
      fontSize: 17,
      fontWeight: '700',
    },
    settingsButton: {
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderColor: palette.borderStrong,
      borderRadius: 14,
      borderWidth: 1,
      justifyContent: 'center',
      marginHorizontal: 24,
      marginTop: 8,
      marginBottom: 12,
      minHeight: 56,
    },
    settingsButtonPressed: {
      backgroundColor: palette.softAccent,
    },
    settingsButtonText: {
      color: palette.heading,
      fontSize: 18,
      fontWeight: '700',
    },
    modalRoot: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    settingsCard: {
      backgroundColor: palette.surfaceAlt,
      borderRadius: 20,
      maxWidth: 440,
      padding: 24,
      width: '100%',
    },
    modalTitle: {
      color: palette.heading,
      fontSize: 26,
      fontWeight: '700',
    },
    modalDescription: {
      color: palette.helper,
      fontSize: 16,
      lineHeight: 22,
      marginBottom: 16,
      marginTop: 6,
    },
    settingRow: {
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      marginTop: 10,
      minHeight: 68,
      paddingHorizontal: 16,
    },
    settingRowPressed: {
      backgroundColor: palette.softAccent,
    },
    settingRowText: {
      flex: 1,
    },
    settingTitle: {
      color: palette.text,
      fontSize: 17,
      fontWeight: '600',
    },
    settingSubtitle: {
      color: palette.muted,
      fontSize: 15,
      marginTop: 3,
    },
    settingArrow: {
      color: palette.heading,
      fontSize: 28,
      marginLeft: 12,
    },
    closeSettingsButton: {
      alignItems: 'center',
      backgroundColor: palette.accent,
      borderRadius: 12,
      justifyContent: 'center',
      marginTop: 18,
      minHeight: 54,
      paddingHorizontal: 18,
    },
    closeSettingsButtonPressed: {
      backgroundColor: palette.accentPressed,
    },
    closeSettingsButtonText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '700',
    },
    submodalLayer: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
    },
    submodalBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    notificationCard: {
      backgroundColor: palette.surfaceAlt,
      borderRadius: 18,
      maxWidth: 400,
      padding: 22,
      width: '100%',
    },
    notificationOption: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    reminderCard: {
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderColor: palette.heading,
      borderRadius: 20,
      borderWidth: 2,
      maxWidth: 440,
      padding: 28,
      width: '100%',
    },
    reminderEyebrow: {
      color: palette.accentText,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 1,
    },
    reminderTitle: {
      color: palette.heading,
      fontSize: 28,
      fontWeight: '700',
      lineHeight: 36,
      marginTop: 16,
      textAlign: 'center',
    },
    reminderTime: {
      color: palette.text,
      fontSize: 32,
      fontWeight: '700',
      marginTop: 16,
    },
  });
}
