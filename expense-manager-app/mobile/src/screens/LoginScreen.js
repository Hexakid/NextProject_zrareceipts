import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { authApi, setToken } from '../services/api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('alice@company.com');
  const [password, setPassword] = useState('Employee@123');

  const login = async () => {
    try {
      const { data } = await authApi.login(email, password);
      setToken(data.accessToken);
      navigation.replace('Submit Expense');
    } catch (e) {
      Alert.alert('Login failed', e.response?.data?.error || 'Try again');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ExpenseManager Mobile</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" />
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={login}><Text style={styles.btnText}>Login</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f8fafc' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 12 },
  btn: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8 },
  btnText: { color: '#fff', textAlign: 'center', fontWeight: '600' }
});
