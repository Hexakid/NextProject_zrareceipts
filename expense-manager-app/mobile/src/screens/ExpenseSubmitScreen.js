import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { expensesApi, receiptsApi } from '../services/api';

export default function ExpenseSubmitScreen() {
  const [form, setForm] = useState({
    projectId: '', categoryId: '', amount: '', expenseDate: new Date().toISOString().slice(0, 10), description: '', merchantName: ''
  });
  const [receiptUri, setReceiptUri] = useState(null);

  const captureReceipt = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      const asset = result.assets[0];
      setReceiptUri(asset.uri);
      const fd = new FormData();
      fd.append('receipt', { uri: asset.uri, name: 'receipt.jpg', type: 'image/jpeg' });
      try {
        const { data } = await receiptsApi.upload(fd);
        const f = data.extractedFields || {};
        setForm((prev) => ({ ...prev, merchantName: f.merchantName || prev.merchantName }));
      } catch {}
    }
  };

  const submit = async () => {
    try {
      const { data } = await expensesApi.create(form);
      await expensesApi.submit(data.expense.id);
      Alert.alert('Success', 'Expense submitted for approval');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Submission failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Submit Expense</Text>
      <TextInput style={styles.input} placeholder="Project ID" value={form.projectId} onChangeText={(v) => setForm({ ...form, projectId: v })} />
      <TextInput style={styles.input} placeholder="Category ID" value={form.categoryId} onChangeText={(v) => setForm({ ...form, categoryId: v })} />
      <TextInput style={styles.input} placeholder="Amount" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} keyboardType="decimal-pad" />
      <TextInput style={styles.input} placeholder="Merchant" value={form.merchantName} onChangeText={(v) => setForm({ ...form, merchantName: v })} />
      <TextInput style={styles.input} placeholder="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} />

      <TouchableOpacity style={styles.secondary} onPress={captureReceipt}><Text style={styles.secondaryText}>{receiptUri ? 'Retake Receipt' : 'Capture Receipt'}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={submit}><Text style={styles.btnText}>Submit</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 10 },
  btn: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, marginTop: 8 },
  btnText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  secondary: { backgroundColor: '#e2e8f0', padding: 12, borderRadius: 8, marginTop: 4 },
  secondaryText: { color: '#334155', textAlign: 'center', fontWeight: '600' }
});
