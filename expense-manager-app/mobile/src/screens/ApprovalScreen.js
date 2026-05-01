import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import axios from 'axios';

export default function ApprovalScreen() {
  const [queue, setQueue] = useState([]);

  const load = async () => {
    try {
      const { data } = await axios.get('http://localhost:3000/api/approvals/queue');
      setQueue(data);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const act = async (expenseId, type) => {
    try {
      await axios.post(`http://localhost:3000/api/approvals/${expenseId}/${type}`, { comments: type === 'reject' ? 'Rejected from mobile' : 'Approved from mobile' });
      load();
    } catch (e) {
      Alert.alert('Action failed', e.response?.data?.error || 'Try again');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Approval Queue</Text>
      <FlatList
        data={queue}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.desc}>{item.Expense?.description}</Text>
            <Text style={styles.amount}>ZWL {parseFloat(item.Expense?.amount || 0).toFixed(2)}</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.approve} onPress={() => act(item.Expense?.id, 'approve')}>
                <Text style={styles.btnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reject} onPress={() => act(item.Expense?.id, 'reject')}>
                <Text style={styles.btnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  desc: { color: '#0f172a', fontWeight: '600' },
  amount: { color: '#334155', marginVertical: 6 },
  row: { flexDirection: 'row', gap: 8 },
  approve: { flex: 1, backgroundColor: '#16a34a', padding: 10, borderRadius: 8 },
  reject: { flex: 1, backgroundColor: '#dc2626', padding: 10, borderRadius: 8 },
  btnText: { color: '#fff', textAlign: 'center', fontWeight: '600' }
});
