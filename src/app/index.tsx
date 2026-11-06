import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScheduledDose = {
  id: string;
  minuteOfDay: number;
};

const initialSchedule: ScheduledDose[] = [{ id: 'example-dose', minuteOfDay: 8 * 60 }];

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
  const [schedule, setSchedule] = useState(initialSchedule);
  const [timeInput, setTimeInput] = useState('');
  const [timeError, setTimeError] = useState('');
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [showNotificationOptions, setShowNotificationOptions] = useState(false);
  const [simulatedDoseTime, setSimulatedDoseTime] = useState<Date | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const nextDose = getNextDose(schedule, now);
  const sortedSchedule = [...schedule].sort((a, b) => a.minuteOfDay - b.minuteOfDay);

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

  function showPlaceholderInfo(setting: string) {
    Alert.alert(setting, 'This setting is a placeholder and is not active yet.');
  }

  function resetApp() {
    setSchedule([...initialSchedule]);
    setTimeInput('');
    setTimeError('');
    setShowTimeForm(false);
    setShowNotificationOptions(false);
    setSimulatedDoseTime(null);
    setShowSettings(false);
  }

  function confirmResetApp() {
    Alert.alert(
      'Reset app?',
      'Restore the example 8:00 AM schedule and close any test reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetApp },
      ],
    );
  }

  return (
    <View style={styles.screen}>
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
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>NEXT SCHEDULED DOSE</Text>
            {nextDose ? (
              <>
                <Text style={styles.time}>{formatDoseTime(nextDose.dose.minuteOfDay)}</Text>
                <Text style={styles.cardDescription}>
                  {formatTimeRemaining(nextDose.date.getTime() - now.getTime())}
                </Text>
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
                  placeholderTextColor="#7A817B"
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
          setShowNotificationOptions(false);
          setShowSettings(false);
          setSimulatedDoseTime(null);
        }}
        transparent
        visible={showSettings || simulatedDoseTime !== null}>
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel={simulatedDoseTime ? 'Close dose reminder' : 'Close settings'}
            onPress={() => {
              setShowNotificationOptions(false);
              setShowSettings(false);
              setSimulatedDoseTime(null);
            }}
            style={styles.modalBackdrop}
          />
          {simulatedDoseTime ? (
            <View accessibilityRole="alert" style={styles.reminderCard}>
              <Text style={styles.reminderEyebrow}>TEST REMINDER</Text>
              <Text style={styles.reminderTitle}>It’s time for your scheduled dose</Text>
              <Text style={styles.reminderTime}>
                {formatDoseTime(
                  simulatedDoseTime.getHours() * 60 + simulatedDoseTime.getMinutes(),
                )}
              </Text>
              <Text style={styles.modalDescription}>
                This is a simulated reminder. Dismissing it does not confirm that medication was
                taken.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSimulatedDoseTime(null);
                  setShowSettings(false);
                }}
                style={({ pressed }) => [
                  styles.closeSettingsButton,
                  pressed && styles.closeSettingsButtonPressed,
                ]}>
                <Text style={styles.closeSettingsButtonText}>Dismiss test reminder</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.settingsCard}>
                <Text style={styles.modalTitle}>Settings</Text>
                <Text style={styles.modalDescription}>More options will be added later.</Text>

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

                <Pressable
                  accessibilityRole="button"
                  onPress={() => showPlaceholderInfo('Light or dark mode')}
                  style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}>
                  <View style={styles.settingRowText}>
                    <Text style={styles.settingTitle}>Light or dark mode</Text>
                    <Text style={styles.settingSubtitle}>Coming soon</Text>
                  </View>
                  <Text style={styles.settingArrow}>›</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSimulatedDoseTime(new Date())}
                  style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}>
                  <View style={styles.settingRowText}>
                    <Text style={styles.settingTitle}>Test dose reminder</Text>
                    <Text style={styles.settingSubtitle}>Preview a simulated dose alert</Text>
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
                      These options are placeholders for now.
                    </Text>
                    {['Sound', 'Vibration', 'On-screen alert'].map((option) => (
                      <View key={option} style={styles.notificationOption}>
                        <Text style={styles.settingTitle}>{option}</Text>
                        <Text style={styles.settingSubtitle}>Coming soon</Text>
                      </View>
                    ))}
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F4EF',
  },
  headerSafeArea: {
    backgroundColor: '#551606',
  },
  body: {
    backgroundColor: '#F6F4EF',
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
    backgroundColor: '#292929',
  },
  statusLight: {
    backgroundColor: '#858B85',
    borderColor: '#FFFFFF',
    borderRadius: 11,
    borderWidth: 3,
    elevation: 3,
    height: 22,
    shadowColor: '#000000',
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
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E4DA',
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
  },
  sectionLabel: {
    color: '#626B64',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  time: {
    color: '#551606',
    fontSize: 48,
    fontWeight: '700',
    marginTop: 12,
  },
  cardDescription: {
    color: '#626B64',
    fontSize: 17,
    marginTop: 4,
  },
  emptyTitle: {
    color: '#551606',
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
    color: '#551606',
    fontSize: 21,
    fontWeight: '700',
  },
  doseCount: {
    color: '#626B64',
    fontSize: 15,
  },
  doseList: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E4DA',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  doseRow: {
    alignItems: 'center',
    borderBottomColor: '#EEEAE2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: 16,
  },
  doseMarker: {
    backgroundColor: '#8B3F29',
    borderRadius: 4,
    height: 8,
    marginRight: 14,
    width: 8,
  },
  doseTime: {
    color: '#303A33',
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
    backgroundColor: '#F5E9E5',
  },
  removeButtonText: {
    color: '#743727',
    fontSize: 15,
    fontWeight: '600',
  },
  emptySchedule: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E4DA',
    borderRadius: 14,
    borderWidth: 1,
    color: '#626B64',
    fontSize: 16,
    padding: 18,
  },
  addForm: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E4DA',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 18,
  },
  inputLabel: {
    color: '#343B36',
    fontSize: 16,
    fontWeight: '600',
  },
  inputHint: {
    color: '#626B64',
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 10,
    marginTop: 4,
  },
  timeInput: {
    backgroundColor: '#F8F7F3',
    borderColor: '#D8D6CD',
    borderRadius: 10,
    borderWidth: 1,
    color: '#551606',
    fontSize: 18,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  errorText: {
    color: '#9B4037',
    fontSize: 14,
    marginTop: 8,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: '#B9BDB8',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 92,
    paddingHorizontal: 14,
  },
  cancelButtonPressed: {
    backgroundColor: '#F0EFEA',
  },
  cancelButtonText: {
    color: '#475149',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#551606',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 108,
    paddingHorizontal: 16,
  },
  saveButtonPressed: {
    backgroundColor: '#3D1004',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  addButton: {
    alignItems: 'center',
    borderColor: '#8B5144',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  addButtonPressed: {
    backgroundColor: '#F6ECE8',
  },
  addButtonText: {
    color: '#551606',
    fontSize: 17,
    fontWeight: '700',
  },
  settingsButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#8B5144',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 12,
    minHeight: 56,
  },
  settingsButtonPressed: {
    backgroundColor: '#F6ECE8',
  },
  settingsButtonText: {
    color: '#551606',
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
    backgroundColor: '#F6F4EF',
    borderRadius: 20,
    maxWidth: 440,
    padding: 24,
    width: '100%',
  },
  modalTitle: {
    color: '#551606',
    fontSize: 26,
    fontWeight: '700',
  },
  modalDescription: {
    color: '#4C554F',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 16,
    marginTop: 6,
  },
  settingRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E4DA',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 10,
    minHeight: 68,
    paddingHorizontal: 16,
  },
  settingRowPressed: {
    backgroundColor: '#F6ECE8',
  },
  settingRowText: {
    flex: 1,
  },
  settingTitle: {
    color: '#303A33',
    fontSize: 17,
    fontWeight: '600',
  },
  settingSubtitle: {
    color: '#626B64',
    fontSize: 15,
    marginTop: 3,
  },
  settingArrow: {
    color: '#551606',
    fontSize: 28,
    marginLeft: 12,
  },
  closeSettingsButton: {
    alignItems: 'center',
    backgroundColor: '#551606',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 54,
    paddingHorizontal: 18,
  },
  closeSettingsButtonPressed: {
    backgroundColor: '#3D1004',
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
    backgroundColor: '#F6F4EF',
    borderRadius: 18,
    maxWidth: 400,
    padding: 22,
    width: '100%',
  },
  notificationOption: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E4DA',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reminderCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#551606',
    borderRadius: 20,
    borderWidth: 2,
    maxWidth: 440,
    padding: 28,
    width: '100%',
  },
  reminderEyebrow: {
    color: '#743727',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  reminderTitle: {
    color: '#551606',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    marginTop: 16,
    textAlign: 'center',
  },
  reminderTime: {
    color: '#303A33',
    fontSize: 32,
    fontWeight: '700',
    marginTop: 16,
  },
});
