import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import bank from './questions.json';

const host = 'https://drive-ready-ua.onrender.com';
const storageKey = 'drive-ready.progress.v1';
const questions = bank.map(([prompt, options, correct, explanation, topic], id) => ({
  id, prompt, options, correct, explanation, topic,
}));

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function open(url) {
  Linking.openURL(url).catch(() => Alert.alert('Не вдалося відкрити посилання'));
}

function Button({ title, onPress, subdued = false, disabled = false }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={[styles.button, subdued && styles.subdued, disabled && styles.disabled]}>
      <Text style={styles.buttonLabel}>{title}</Text>
    </Pressable>
  );
}

function AppContent() {
  const [progress, setProgress] = useState(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [session, setSession] = useState(null);
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey).then(raw => {
      const saved = raw ? JSON.parse(raw) : {};
      const mistakes = Array.isArray(saved.mistakes) ? saved.mistakes.filter(id => questions[id]) : [];
      const completed = Number.isSafeInteger(saved.completed) && saved.completed >= 0 ? saved.completed : 0;
      if (mounted) setProgress({ mistakes: [...new Set(mistakes)], completed });
    }).catch(() => {
      if (mounted) {
        setStorageWarning(true);
        setProgress({ mistakes: [], completed: 0 });
      }
    });
    return () => { mounted = false; };
  }, []);

  function save(next) {
    setProgress(next);
    AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => setStorageWarning(true));
  }

  function start(review) {
    const pool = review ? questions.filter(q => progress.mistakes.includes(q.id)) : questions;
    if (!pool.length) return;
    setSession({ review, queue: shuffle(pool).slice(0, 10), index: 0, selected: null, correct: 0, complete: false });
  }

  function choose(index) {
    if (session.selected !== null) return;
    const question = session.queue[session.index];
    const right = index === question.correct;
    const mistakes = new Set(progress.mistakes);
    if (!right) mistakes.add(question.id);
    else if (session.review) mistakes.delete(question.id);
    save({ ...progress, mistakes: [...mistakes] });
    setSession({ ...session, selected: index, correct: session.correct + (right ? 1 : 0) });
  }

  function advance() {
    if (session.index === session.queue.length - 1) {
      save({ ...progress, completed: progress.completed + 1 });
      setSession({ ...session, complete: true });
    } else {
      setSession({ ...session, index: session.index + 1, selected: null });
    }
  }

  const current = session?.queue[session.index];
  const answered = session?.selected !== null;
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.page} key={session ? session.complete ? 'complete' : session.index : 'home'}>
        <View style={styles.hero}>
          <Image source={require('./assets/adaptive-icon.png')} style={styles.brandImage} accessibilityIgnoresInvertColors />
          <View style={styles.heroCopy}>
            <Text accessibilityRole="header" style={styles.heroTitle}>DRIVE READY UA</Text>
            <Text style={styles.heroSubtitle}>Теорія та підготовка до водіння</Text>
          </View>
        </View>
        {storageWarning && <Text style={styles.body} accessibilityRole="alert">Збереження прогресу недоступне. Тренування можна продовжити в цьому сеансі.</Text>}
        {!session && (
          <>
            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.title}>Тренування ПДР</Text>
              <Text style={styles.body}>10 запитань із поясненнями. Працює без інтернету.</Text>
              <Button title="Почати тренування" onPress={() => start(false)} disabled={!progress} />
              <Button title={'Повторити помилки · ' + (progress?.mistakes.length ?? 0)}
                onPress={() => start(true)} subdued disabled={!progress?.mistakes.length} />
              <Text style={styles.body}>Завершені тренування: {progress?.completed ?? 0}</Text>
            </View>
            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.title}>Практика водіння</Text>
              <Button title="Екзаменаційні маршрути ↗" subdued onPress={() => open(host + '/routes.html')} />
              <Button title="Запис на заняття DRIVE TIME ↗" subdued onPress={() => open('https://drive-time-booking-ov62.onrender.com/')} />
              <Button title="Конфіденційність ↗" subdued onPress={() => open(host + '/privacy.html')} />
            </View>
          </>
        )}
        {session?.complete && (
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>Результат тренування</Text>
            <Text style={styles.body}>Правильних відповідей: {session.correct} з {session.queue.length}</Text>
            <Button title="Повторити помилки" onPress={() => start(true)} disabled={!progress.mistakes.length} />
            <Button title="Повернутися до підготовки" subdued onPress={() => setSession(null)} />
          </View>
        )}
        {session && !session.complete && (
          <View style={styles.card}>
            <Text style={styles.progress}>Питання {session.index + 1} з {session.queue.length} · {current.topic}</Text>
            <Text accessibilityRole="header" style={styles.title}>{current.prompt}</Text>
            {current.options.map((option, index) => {
              const correct = answered && index === current.correct;
              const incorrect = answered && session.selected === index && !correct;
              return (
                <Pressable key={index} accessibilityRole="button" accessibilityState={{ disabled: answered, selected: session.selected === index }}
                  disabled={answered} onPress={() => choose(index)} style={[styles.answer, correct && styles.correct, incorrect && styles.incorrect]}>
                  <Text style={styles.body}>{index + 1}. {option}</Text>
                </Pressable>
              );
            })}
            {answered && (
              <>
                <Text accessibilityLiveRegion="polite" style={styles.explanation}>
                  {session.selected === current.correct ? 'Правильно. ' : 'Правильна відповідь: ' + current.options[current.correct] + '. '}
                  {current.explanation.trim()}
                </Text>
                <Button title={session.index === session.queue.length - 1 ? 'Показати результат' : 'Наступне питання'} onPress={advance} />
              </>
            )}
            <Button title="До меню" subdued onPress={() => setSession(null)} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f3f7f3' },
  page: { padding: 16, gap: 14, width: '100%', maxWidth: 680, alignSelf: 'center' },
  hero: { backgroundColor: '#10221a', minHeight: 100, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandImage: { width: 64, height: 64 },
  heroCopy: { flex: 1, gap: 5 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#b7f469' },
  heroSubtitle: { fontSize: 15, color: '#e2f0e6' },
  card: { gap: 12, padding: 16, backgroundColor: '#fff', borderRadius: 18, borderColor: '#d8e1d9', borderWidth: 1 },
  title: { color: '#10221a', fontSize: 22, fontWeight: '800' },
  body: { color: '#2e4837', fontSize: 16, lineHeight: 23 },
  progress: { color: '#2e4837', fontSize: 15, fontWeight: '700' },
  button: { backgroundColor: '#b7f469', minHeight: 48, justifyContent: 'center', borderRadius: 10, padding: 11 },
  subdued: { backgroundColor: '#e8f0e8' },
  disabled: { opacity: 0.5 },
  buttonLabel: { color: '#10221a', fontSize: 16, textAlign: 'center', fontWeight: '800' },
  answer: { backgroundColor: '#f3f7f3', borderRadius: 10, borderWidth: 1, borderColor: '#bacbbd', minHeight: 48, justifyContent: 'center', padding: 10 },
  correct: { backgroundColor: '#dbf8da', borderColor: '#43844b' },
  incorrect: { backgroundColor: '#f9e3e1', borderColor: '#a6504b' },
  explanation: { backgroundColor: '#edf4e9', color: '#10221a', borderRadius: 10, padding: 12, fontSize: 16, lineHeight: 23 },
});
