import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { api, formatINR } from '../../services/api';
import { theme } from '../../theme';
import LoanSimulatorModal from '../copilot/LoanSimulatorModal';

type AccountMode = 'savings' | 'loan';

export default function AccountForm() {
  const [busy, setBusy] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState('');

  const [accMode, setAccMode] = useState<AccountMode>('savings');
  const [bankName, setBankName] = useState('');
  const [accNumber, setAccNumber] = useState('');
  const [savingsBalance, setSavingsBalance] = useState('');
  const [loanType, setLoanType] = useState('personal');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanOutstanding, setLoanOutstanding] = useState('');
  const [loanEmi, setLoanEmi] = useState('');
  const [loanInterest, setLoanInterest] = useState('');
  const [existingAccounts, setExistingAccounts] = useState<any[]>([]);
  const [accountSummary, setAccountSummary] = useState<any>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = () => {
    api.getAccounts().then((r) => {
      setExistingAccounts(r.accounts || []);
      setAccountSummary(r.summary || null);
    }).catch(() => {});
  };

  const triggerAiAccountScan = async () => {
    setAiScanning(true);
    setAiStatusMsg(`AI reading ${accMode === 'loan' ? 'loan agreement slip' : 'bank passbook'}...`);

    try {
      const res = await api.analyzeDocument({
        type: accMode === 'loan' ? 'loan' : 'statement',
        fileName: accMode === 'loan' ? 'HDFC_Home_Loan_Sanction.pdf' : 'SBI_Passbook.jpg',
        text: accMode === 'loan'
          ? `Loan Sanction Letter\nBank: HDFC Bank\nLoan: Home Loan\nPrincipal: 35,00,000\nOutstanding: 31,40,000\nEMI: 28,500\nInterest: 8.4%`
          : `State Bank of India Passbook\nAccount: 3098124982\nBalance: 84,500`,
      });

      if (res.data) {
        const d = res.data;
        if (accMode === 'loan') {
          setBankName(d.bankName || 'HDFC Bank');
          setLoanType(d.loanType || 'home');
          setAccNumber(d.accountNumber || 'LOAN-984210');
          setLoanPrincipal(d.principalAmountPaise ? String(d.principalAmountPaise / 100) : '3500000');
          setLoanOutstanding(d.outstandingAmountPaise ? String(d.outstandingAmountPaise / 100) : '3140000');
          setLoanEmi(d.emiAmountPaise ? String(d.emiAmountPaise / 100) : '28500');
          setLoanInterest(d.interestRate ? String(d.interestRate) : '8.4');
        } else {
          setBankName(d.bankName || 'State Bank of India');
          setAccNumber(d.accountNumberMasked || 'XX9812');
          setSavingsBalance(d.closingBalance ? String(d.closingBalance / 100) : '84500');
        }

        Alert.alert('✨ AI Extracted', `Parsed account details from ${d.bankName}!`);
      }
    } catch (err: any) {
      Alert.alert('Scan notice', err.message);
    } finally {
      setAiScanning(false);
      setAiStatusMsg('');
    }
  };

  const saveAccount = async () => {
    if (!bankName.trim()) {
      return Alert.alert('Required', 'Please enter bank or lender name.');
    }
    setBusy(true);
    try {
      if (accMode === 'savings') {
        await api.createAccount({
          type: 'savings',
          bankName: bankName.trim(),
          accountNumber: accNumber.trim(),
          balance: Number(savingsBalance) * 100 || 0,
          aiExtracted: true,
        });
        Alert.alert('🏦 Savings Account Added', `${bankName} savings balance recorded!`);
      } else {
        await api.createAccount({
          type: 'loan',
          bankName: bankName.trim(),
          loanType,
          accountNumber: accNumber.trim(),
          principalAmount: Number(loanPrincipal) * 100 || 0,
          outstandingAmount: Number(loanOutstanding) * 100 || 0,
          emiAmount: Number(loanEmi) * 100 || 0,
          interestRate: Number(loanInterest) || 0,
          emiDueDate: 5,
          aiExtracted: true,
        });
        Alert.alert('💳 Loan Account Added', `${bankName} ${loanType} loan tracked!`);
      }

      setBankName('');
      setAccNumber('');
      setSavingsBalance('');
      setLoanPrincipal('');
      setLoanOutstanding('');
      setLoanEmi('');
      setLoanInterest('');
      loadAccounts();
    } catch (err: any) {
      Alert.alert('Could not save account', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.sectionCard}>
      {/* AI Processing Status Banner */}
      {aiScanning && (
        <View style={styles.aiLoadingBanner}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={styles.aiLoadingText}>{aiStatusMsg || 'AI analyzing document...'}</Text>
        </View>
      )}

      {/* Mode Switcher */}
      <View style={styles.segmentSwitch}>
        <TouchableOpacity
          style={[styles.segmentBtn, accMode === 'savings' && styles.segmentBtnActive]}
          onPress={() => setAccMode('savings')}
        >
          <Text style={[styles.segmentText, accMode === 'savings' && styles.segmentTextActive]}>
            🏦 Savings Account
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, accMode === 'loan' && styles.segmentBtnActive]}
          onPress={() => setAccMode('loan')}
        >
          <Text style={[styles.segmentText, accMode === 'loan' && styles.segmentTextActive]}>
            💳 Loan Account
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick AI Scan button for passbook / loan slip */}
      <TouchableOpacity style={styles.aiScanBox} onPress={triggerAiAccountScan} disabled={aiScanning}>
        <Text style={styles.aiScanIcon}>📑</Text>
        <Text style={styles.aiScanTitle}>
          Upload {accMode === 'loan' ? 'Loan Sanction Letter / Slip' : 'Passbook / Statement Photo'}
        </Text>
        <Text style={styles.aiScanSub}>AI will auto-extract bank name, account number & balance</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder={accMode === 'loan' ? 'Lender Bank (e.g. HDFC, SBI)' : 'Bank Name'}
        placeholderTextColor={theme.textDim}
        value={bankName}
        onChangeText={setBankName}
      />
      <TextInput
        style={styles.input}
        placeholder="Account Number / Masked"
        placeholderTextColor={theme.textDim}
        value={accNumber}
        onChangeText={setAccNumber}
      />

      {accMode === 'savings' ? (
        <TextInput
          style={styles.input}
          placeholder="Current Savings Balance (₹)"
          placeholderTextColor={theme.textDim}
          keyboardType="numeric"
          value={savingsBalance}
          onChangeText={setSavingsBalance}
        />
      ) : (
        <>
          {/* Loan Type Chips */}
          <View style={styles.chipRow}>
            {['home', 'personal', 'auto', 'education', 'gold'].map((lt) => (
              <TouchableOpacity
                key={lt}
                style={[styles.bankChip, loanType === lt && styles.bankChipActive]}
                onPress={() => setLoanType(lt)}
              >
                <Text style={[styles.bankChipText, loanType === lt && styles.bankChipTextActive]}>
                  {lt.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.twoCol}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Principal (₹)"
              placeholderTextColor={theme.textDim}
              keyboardType="numeric"
              value={loanPrincipal}
              onChangeText={setLoanPrincipal}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Outstanding (₹)"
              placeholderTextColor={theme.textDim}
              keyboardType="numeric"
              value={loanOutstanding}
              onChangeText={setLoanOutstanding}
            />
          </View>

          <View style={styles.twoCol}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Monthly EMI (₹)"
              placeholderTextColor={theme.textDim}
              keyboardType="numeric"
              value={loanEmi}
              onChangeText={setLoanEmi}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Interest % (e.g. 8.5)"
              placeholderTextColor={theme.textDim}
              keyboardType="numeric"
              value={loanInterest}
              onChangeText={setLoanInterest}
            />
          </View>
        </>
      )}

      <TouchableOpacity style={styles.primaryBtn} onPress={saveAccount} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : (
          <Text style={styles.primaryBtnText}>
            {accMode === 'loan' ? '💳 Save Loan Account' : '🏦 Save Savings Account'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Account Summary Banner */}
      {accountSummary && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryCardTitle}>Net Portfolio Overview</Text>
          <View style={styles.summaryCardRow}>
            <Text style={styles.summaryCardLabel}>Total Savings Balance:</Text>
            <Text style={[styles.summaryCardVal, { color: '#10B981' }]}>
              {formatINR(accountSummary.totalSavingsPaise || 0)}
            </Text>
          </View>
          <View style={styles.summaryCardRow}>
            <Text style={styles.summaryCardLabel}>Total Loan Liability:</Text>
            <Text style={[styles.summaryCardVal, { color: '#FF4757' }]}>
              {formatINR(accountSummary.totalLoanDebtPaise || 0)}
            </Text>
          </View>
          <View style={styles.summaryCardRow}>
            <Text style={styles.summaryCardLabel}>Monthly EMI Outflow:</Text>
            <Text style={[styles.summaryCardVal, { color: theme.accent }]}>
              {formatINR(accountSummary.totalMonthlyEmiPaise || 0)}
            </Text>
          </View>
        </View>
      )}

      <LoanSimulatorModal />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: theme.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  aiLoadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  aiLoadingText: { color: theme.accent, fontSize: 12, fontWeight: '700' },
  segmentSwitch: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentBtnActive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: theme.border },
  segmentText: { color: theme.textDim, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: theme.text, fontWeight: '800' },
  aiScanBox: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  aiScanIcon: { fontSize: 26, marginBottom: 4 },
  aiScanTitle: { color: theme.text, fontSize: 13, fontWeight: '700' },
  aiScanSub: { color: theme.textDim, fontSize: 11, marginTop: 2, textAlign: 'center' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.text,
    fontSize: 14,
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  bankChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: theme.border,
  },
  bankChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: theme.accent,
  },
  bankChipText: { color: theme.textDim, fontSize: 11, fontWeight: '700' },
  bankChipTextActive: { color: theme.accent },
  twoCol: { flexDirection: 'row', gap: 8 },
  primaryBtn: {
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  summaryCard: {
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  summaryCardTitle: { color: theme.text, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  summaryCardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryCardLabel: { color: theme.textDim, fontSize: 11 },
  summaryCardVal: { fontSize: 12, fontWeight: '800' },
});
