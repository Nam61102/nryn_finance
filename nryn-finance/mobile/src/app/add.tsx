import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { api, formatINR } from '../services/api';
import { theme, FALLBACK_CATEGORIES } from '../theme';
import AiRecommendationsCard from '../components/AiRecommendationsCard';

type HubTab = 'statement' | 'insurance' | 'account' | 'cash' | 'advice';
type InsuranceType = 'health' | 'car' | 'medical' | 'life' | 'other';
type AccountMode = 'savings' | 'loan';

export default function FinancialHubAdd() {
  const [activeTab, setActiveTab] = useState<HubTab>('statement');
  const [busy, setBusy] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState('');

  // ── Tab 1: Bank Statement State ──
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [statementFileName, setStatementFileName] = useState('');
  const [statementInputText, setStatementInputText] = useState('');
  const [parsedStatement, setParsedStatement] = useState<any>(null);

  // ── Tab 2: Insurance & Policy State ──
  const [insType, setInsType] = useState<InsuranceType>('health');
  const [insOcrInputText, setInsOcrInputText] = useState('');
  const [insProvider, setInsProvider] = useState('');
  const [insTitle, setInsTitle] = useState('');
  const [insPolicyNo, setInsPolicyNo] = useState('');
  const [insSumInsured, setInsSumInsured] = useState('');
  const [insPremium, setInsPremium] = useState('');
  const [insExpiry, setInsExpiry] = useState('');
  const [existingPolicies, setExistingPolicies] = useState<any[]>([]);

  // ── Tab 3: Accounts & Loans State ──
  const [accMode, setAccMode] = useState<AccountMode>('savings');
  const [accOcrInputText, setAccOcrInputText] = useState('');
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

  // ── Tab 4: Cash Expense State ──
  const [cashAmount, setCashAmount] = useState('');
  const [cashMerchant, setCashMerchant] = useState('');
  const [cashNote, setCashNote] = useState('');
  const [cashCategory, setCashCategory] = useState('food');
  const [cats, setCats] = useState(FALLBACK_CATEGORIES);

  useEffect(() => {
    loadCategories();
    loadPolicies();
    loadAccounts();
  }, []);

  const loadCategories = () => {
    api.categories().then((r) => setCats(r.categories)).catch(() => {});
  };

  const loadPolicies = () => {
    api.getPolicies().then((r) => setExistingPolicies(r.policies || [])).catch(() => {});
  };

  const loadAccounts = () => {
    api.getAccounts().then((r) => {
      setExistingAccounts(r.accounts || []);
      setAccountSummary(r.summary || null);
    }).catch(() => {});
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  // ── AI Scanner Action for Statement ──
  const triggerAiStatementScan = async (fileName = 'Bank_Statement.pdf') => {
    const textToScan = statementInputText.trim();
    if (!textToScan) {
      return Alert.alert(
        'Paste Statement Text',
        'Please enter or paste your bank statement transactions or SMS dump in the box below so AI can dynamically analyze it.'
      );
    }

    setAiScanning(true);
    setAiStatusMsg('AI scanning statement tables & OCR...');
    setStatementFileName(fileName);

    try {
      const res = await api.analyzeDocument({
        type: 'statement',
        fileName,
        text: textToScan,
      });

      if (res.data) {
        setParsedStatement(res.data);
        const count = res.data.transactionCount || res.data.transactions?.length || 0;
        if (count > 0) {
          Alert.alert(
            '✨ AI Statement Analyzed',
            `Detected ${count} transactions from ${res.data.bankName || selectedBank}!`
          );
        } else {
          Alert.alert(
            'Analysis Complete',
            'No transactions could be detected in the provided text. Please check the date and amount format.'
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Scan notice', err.message || 'Could not parse statement');
    } finally {
      setAiScanning(false);
      setAiStatusMsg('');
    }
  };

  // ── Import Statement Txns to Dashboard ──
  const importParsedTransactions = async () => {
    if (!parsedStatement?.transactions?.length) return;
    setBusy(true);
    try {
      const res = await api.importStatement({
        transactions: parsedStatement.transactions,
        bankName: parsedStatement.bankName,
        accountMasked: parsedStatement.accountNumberMasked,
      });
      Alert.alert('✅ Transactions Imported', res.message || 'Imported to your financial records!', [
        { text: 'View Dashboard', onPress: () => router.replace('/(tabs)') },
        { text: 'Stay Here', style: 'cancel' }
      ]);
      setParsedStatement(null);
      setStatementFileName('');
    } catch (err: any) {
      Alert.alert('Import error', err.message);
    } finally {
      setBusy(false);
    }
  };

  // ── AI Scanner Action for Insurance Photo ──
  const triggerAiInsuranceScan = async () => {
    const textToScan = insOcrInputText.trim();
    if (!textToScan) {
      return Alert.alert(
        'Paste Policy Text',
        'Please enter or paste your policy document text/details in the box above so AI can parse it, or fill the fields below directly.'
      );
    }

    setAiScanning(true);
    setAiStatusMsg(`AI extracting ${insType.toUpperCase()} insurance policy details...`);

    try {
      const res = await api.analyzeDocument({
        type: 'insurance',
        fileName: `${insType}_policy_doc.txt`,
        text: textToScan,
      });

      if (res.data) {
        const d = res.data;
        if (d.provider) setInsProvider(d.provider);
        if (d.title) setInsTitle(d.title);
        if (d.policyNumber) setInsPolicyNo(d.policyNumber);
        if (d.sumInsuredPaise) setInsSumInsured(String(d.sumInsuredPaise / 100));
        if (d.premiumAmountPaise) setInsPremium(String(d.premiumAmountPaise / 100));
        if (d.expiryDate) setInsExpiry(d.expiryDate);

        Alert.alert(
          '✨ AI Policy Extracted',
          `Detected ${d.provider || 'policy'}${d.sumInsuredPaise ? ` with sum insured of ₹${((d.sumInsuredPaise) / 100).toLocaleString('en-IN')}` : ''}!`
        );
      }
    } catch (err: any) {
      Alert.alert('Scan error', err.message);
    } finally {
      setAiScanning(false);
      setAiStatusMsg('');
    }
  };

  // ── Save Policy ──
  const savePolicy = async () => {
    if (!insProvider.trim() || !insTitle.trim()) {
      return Alert.alert('Required', 'Please enter or scan policy provider and title.');
    }
    setBusy(true);
    try {
      await api.createPolicy({
        type: insType,
        title: insTitle.trim(),
        provider: insProvider.trim(),
        policyNumber: insPolicyNo.trim(),
        sumInsured: Number(insSumInsured) * 100 || 0,
        premiumAmount: Number(insPremium) * 100 || 0,
        expiryDate: insExpiry || undefined,
        aiExtracted: true,
      });

      Alert.alert('🛡️ Policy Saved', `${insTitle} has been saved to your Insurance Vault!`);
      setInsProvider('');
      setInsTitle('');
      setInsPolicyNo('');
      setInsSumInsured('');
      setInsPremium('');
      setInsExpiry('');
      setInsOcrInputText('');
      loadPolicies();
    } catch (err: any) {
      Alert.alert('Could not save policy', err.message);
    } finally {
      setBusy(false);
    }
  };

  // ── AI Scanner Action for Loan / Passbook ──
  const triggerAiAccountScan = async () => {
    const textToScan = accOcrInputText.trim();
    if (!textToScan) {
      return Alert.alert(
        'Paste Document Text',
        'Please enter or paste your passbook or loan sanction letter text above so AI can parse it, or fill the fields below directly.'
      );
    }

    setAiScanning(true);
    setAiStatusMsg(`AI reading ${accMode === 'loan' ? 'loan agreement slip' : 'bank passbook'}...`);

    try {
      const res = await api.analyzeDocument({
        type: accMode === 'loan' ? 'loan' : 'statement',
        fileName: accMode === 'loan' ? 'loan_sanction.txt' : 'passbook.txt',
        text: textToScan,
      });

      if (res.data) {
        const d = res.data;
        if (accMode === 'loan') {
          if (d.bankName) setBankName(d.bankName);
          if (d.loanType) setLoanType(d.loanType);
          if (d.accountNumber) setAccNumber(d.accountNumber);
          if (d.principalAmountPaise) setLoanPrincipal(String(d.principalAmountPaise / 100));
          if (d.outstandingAmountPaise) setLoanOutstanding(String(d.outstandingAmountPaise / 100));
          if (d.emiAmountPaise) setLoanEmi(String(d.emiAmountPaise / 100));
          if (d.interestRate) setLoanInterest(String(d.interestRate));
        } else {
          if (d.bankName) setBankName(d.bankName);
          if (d.accountNumberMasked) setAccNumber(d.accountNumberMasked);
          if (d.closingBalance) setSavingsBalance(String(d.closingBalance / 100));
        }

        Alert.alert('✨ AI Extracted', `Parsed account details from ${d.bankName || 'document'}!`);
      }
    } catch (err: any) {
      Alert.alert('Scan notice', err.message);
    } finally {
      setAiScanning(false);
      setAiStatusMsg('');
    }
  };

  // ── Save Account / Loan ──
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

  // ── Save Cash Expense ──
  const saveCashExpense = async () => {
    const val = Number(cashAmount);
    if (!val || val <= 0) return Alert.alert('Enter amount', 'Please enter a valid cash amount.');
    setBusy(true);
    try {
      await api.createCashExpense({
        amount: val,
        merchantName: cashMerchant.trim() || 'Cash Expense',
        note: cashNote.trim() || undefined,
        category: cashCategory,
      });

      Alert.alert('💵 Cash Expense Recorded', `₹${val.toLocaleString('en-IN')} added to your expenses!`, [
        { text: 'View Dashboard', onPress: () => router.replace('/(tabs)') },
        { text: 'Add Another', onPress: () => { setCashAmount(''); setCashMerchant(''); setCashNote(''); } }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>✨ AI Hub Active</Text>
        </View>
      </View>

      <Text style={styles.h1}>Financial Hub & Upload</Text>
      <Text style={styles.subtitle}>
        Upload bank statements, insurance policies, loans, or log cash expenses with AI analysis.
      </Text>

      {/* 4 Feature Tabs Segment */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'statement' && styles.tabItemActive]}
          onPress={() => setActiveTab('statement')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'statement' && styles.tabTextActive]}>
            📄 Statement
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'insurance' && styles.tabItemActive]}
          onPress={() => setActiveTab('insurance')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'insurance' && styles.tabTextActive]}>
            🛡️ Insurance
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'account' && styles.tabItemActive]}
          onPress={() => setActiveTab('account')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'account' && styles.tabTextActive]}>
            🏦 Accounts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'cash' && styles.tabItemActive]}
          onPress={() => setActiveTab('cash')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'cash' && styles.tabTextActive]}>
            💵 Cash
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'advice' && styles.tabItemActive]}
          onPress={() => setActiveTab('advice')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'advice' && styles.tabTextActive]}>
            💡 Advice
          </Text>
        </TouchableOpacity>
      </View>

      {/* AI Processing Status Banner */}
      {aiScanning && (
        <View style={styles.aiLoadingBanner}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={styles.aiLoadingText}>{aiStatusMsg || 'AI analyzing document...'}</Text>
        </View>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: BANK STATEMENT UPLOAD & AI PARSER                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'statement' && (
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Upload Bank Statement</Text>
            <Text style={styles.cardBadge}>Image or PDF</Text>
          </View>
          <Text style={styles.cardHint}>
            Upload your e-statement PDF or scan photo. AI will parse all transactions and calculate credits & debits.
          </Text>

          {/* Quick Bank Selectors */}
          <Text style={styles.fieldLabel}>Select Bank</Text>
          <View style={styles.chipRow}>
            {['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 'Kotak'].map((b) => (
              <TouchableOpacity
                key={b}
                style={[styles.bankChip, selectedBank === b && styles.bankChipActive]}
                onPress={() => setSelectedBank(b)}
              >
                <Text style={[styles.bankChipText, selectedBank === b && styles.bankChipTextActive]}>
                  {b.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Statement Input Box */}
          <Text style={styles.fieldLabel}>Statement / SMS Text</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Paste your bank statement transactions or SMS dump here..."
            placeholderTextColor={theme.textDim}
            multiline
            numberOfLines={4}
            value={statementInputText}
            onChangeText={setStatementInputText}
          />

          {/* Upload Drop Zone */}
          <View style={styles.uploadDropZone}>
            <Text style={styles.dropZoneIcon}>📑</Text>
            <Text style={styles.dropZoneTitle}>
              {statementFileName ? `Selected: ${statementFileName}` : 'Scan & Analyze Statement Text'}
            </Text>
            <Text style={styles.dropZoneSub}>AI parses transactions, dates, debits & credits</Text>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.uploadActionBtn}
                onPress={() => triggerAiStatementScan(`${selectedBank.replace(/\s+/g, '_')}_Statement.pdf`)}
                disabled={aiScanning}
              >
                <Text style={styles.uploadActionBtnText}>📁 AI Analyze Text</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Parsed Statement Results Preview */}
          {parsedStatement && (
            <View style={styles.resultsBox}>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>✨ AI Extraction Summary</Text>
                <Text style={styles.resultsBank}>{parsedStatement.bankName}</Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>Total Debits</Text>
                  <Text style={[styles.statBoxVal, { color: '#FF4757' }]}>
                    {formatINR(parsedStatement.totalDebits || 0)}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>Total Credits</Text>
                  <Text style={[styles.statBoxVal, { color: '#10B981' }]}>
                    {formatINR(parsedStatement.totalCredits || 0)}
                  </Text>
                </View>
              </View>

              <Text style={styles.txnsSubhead}>
                Extracted Transactions ({parsedStatement.transactions?.length || 0}):
              </Text>

              {parsedStatement.transactions?.slice(0, 5).map((t: any, idx: number) => (
                <View key={idx} style={styles.stmtRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stmtDesc} numberOfLines={1}>{t.description}</Text>
                    <Text style={styles.stmtDate}>{t.date} · {t.category}</Text>
                  </View>
                  <Text style={[styles.stmtAmt, { color: t.direction === 'credit' ? '#10B981' : theme.text }]}>
                    {t.direction === 'credit' ? '+' : '-'}₹{(t.amountPaise / 100).toLocaleString('en-IN')}
                  </Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={importParsedTransactions}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.primaryBtnText}>
                    ✨ Import All {parsedStatement.transactions?.length} Transactions to Dashboard
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: INSURANCE & POLICY PHOTO UPLOAD & VAULT               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'insurance' && (
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Insurance & Policy Vault</Text>
            <Text style={styles.cardBadge}>Photo / Doc</Text>
          </View>
          <Text style={styles.cardHint}>
            Upload a photo of your health, car, medical, or life insurance policy. AI will automatically read your policy details.
          </Text>

          {/* Insurance Type Chips */}
          <Text style={styles.fieldLabel}>Insurance Category</Text>
          <View style={styles.chipRow}>
            {[
              { id: 'health', label: '🩺 Health' },
              { id: 'car', label: '🚗 Car / Vehicle' },
              { id: 'medical', label: '🏥 Medical' },
              { id: 'life', label: '👨‍👩‍👧 Life / Term' },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.bankChip, insType === item.id && styles.bankChipActive]}
                onPress={() => setInsType(item.id as InsuranceType)}
              >
                <Text style={[styles.bankChipText, insType === item.id && styles.bankChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Policy OCR / Text Input */}
          <Text style={styles.fieldLabel}>Policy Text / Certificate (Optional)</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Optional: Paste policy certificate text, notes, or insurance SMS here..."
            placeholderTextColor={theme.textDim}
            multiline
            numberOfLines={3}
            value={insOcrInputText}
            onChangeText={setInsOcrInputText}
          />

          {/* Upload Insurance Photo / Scan Button */}
          <TouchableOpacity
            style={styles.aiScanBox}
            onPress={triggerAiInsuranceScan}
            disabled={aiScanning}
          >
            <Text style={styles.aiScanIcon}>📸</Text>
            <Text style={styles.aiScanTitle}>AI Auto-Fill from Policy Text</Text>
            <Text style={styles.aiScanSub}>AI will auto-fill provider, sum insured, premium & renewal date</Text>
          </TouchableOpacity>

          {/* Policy Fields (Editable after AI scan) */}
          <TextInput
            style={styles.input}
            placeholder="Provider (e.g. Star Health, HDFC ERGO, LIC)"
            placeholderTextColor={theme.textDim}
            value={insProvider}
            onChangeText={setInsProvider}
          />
          <TextInput
            style={styles.input}
            placeholder="Policy Title (e.g. Comprehensive Health Cover)"
            placeholderTextColor={theme.textDim}
            value={insTitle}
            onChangeText={setInsTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Policy Number"
            placeholderTextColor={theme.textDim}
            value={insPolicyNo}
            onChangeText={setInsPolicyNo}
          />

          <View style={styles.twoCol}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Sum Insured (₹)"
              placeholderTextColor={theme.textDim}
              keyboardType="numeric"
              value={insSumInsured}
              onChangeText={setInsSumInsured}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Premium (₹/yr)"
              placeholderTextColor={theme.textDim}
              keyboardType="numeric"
              value={insPremium}
              onChangeText={setInsPremium}
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Expiry / Renewal Date (YYYY-MM-DD)"
            placeholderTextColor={theme.textDim}
            value={insExpiry}
            onChangeText={setInsExpiry}
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={savePolicy} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.primaryBtnText}>🛡️ Save to Policy Vault</Text>
            )}
          </TouchableOpacity>

          {/* Active Policies List */}
          {existingPolicies.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <Text style={styles.fieldLabel}>Active Policies ({existingPolicies.length})</Text>
              {existingPolicies.map((p) => (
                <View key={p._id} style={styles.policyCard}>
                  <View style={styles.policyTopRow}>
                    <Text style={styles.policyBadge}>{p.type?.toUpperCase()}</Text>
                    <Text style={styles.policyStatus}>Active</Text>
                  </View>
                  <Text style={styles.policyTitle}>{p.title}</Text>
                  <Text style={styles.policyProvider}>{p.provider} · #{p.policyNumber || 'N/A'}</Text>
                  <View style={styles.policyBottomRow}>
                    <Text style={styles.policyMetric}>Cover: ₹{((p.sumInsured || 0) / 100).toLocaleString('en-IN')}</Text>
                    <Text style={styles.policyPremium}>Premium: ₹{((p.premiumAmount || 0) / 100).toLocaleString('en-IN')}/yr</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: ACCOUNTS (SAVINGS & LOANS)                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'account' && (
        <View style={styles.sectionCard}>
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

          {/* Account Document OCR / Text Input */}
          <Text style={styles.fieldLabel}>Document / Sanction Text (Optional)</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder={accMode === 'loan' ? "Optional: Paste loan sanction letter, EMI schedule or rate text..." : "Optional: Paste passbook balance, account number text..."}
            placeholderTextColor={theme.textDim}
            multiline
            numberOfLines={3}
            value={accOcrInputText}
            onChangeText={setAccOcrInputText}
          />

          {/* Quick AI Scan button for passbook / loan slip */}
          <TouchableOpacity style={styles.aiScanBox} onPress={triggerAiAccountScan} disabled={aiScanning}>
            <Text style={styles.aiScanIcon}>📑</Text>
            <Text style={styles.aiScanTitle}>
              AI Auto-Fill from {accMode === 'loan' ? 'Loan Sanction Text' : 'Passbook Text'}
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
        </View>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 4: CASH EXPENSES LOGGER WITH RECEIPT SCAN               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'cash' && (
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Add Cash Expense</Text>
            <Text style={styles.cardBadge}>Manual / Cash</Text>
          </View>
          <Text style={styles.cardHint}>
            Record cash purchases that do not send an SMS, or scan physical bills and receipts.
          </Text>

          {/* Amount Row */}
          <View style={styles.amountRow}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={theme.textDim}
              keyboardType="decimal-pad"
              value={cashAmount}
              onChangeText={setCashAmount}
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Where? (Merchant / Store / Person)"
            placeholderTextColor={theme.textDim}
            value={cashMerchant}
            onChangeText={setCashMerchant}
          />
          <TextInput
            style={styles.input}
            placeholder="Note (optional)"
            placeholderTextColor={theme.textDim}
            value={cashNote}
            onChangeText={setCashNote}
          />

          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.catGrid}>
            {cats.map((c: any) => {
              const catKey = c.key || c.id;
              const catLabel = c.label || c.name;
              const catIcon = c.icon || c.emoji || '📦';
              return (
                <TouchableOpacity
                  key={catKey}
                  style={[styles.catChip, cashCategory === catKey && styles.catChipActive]}
                  onPress={() => setCashCategory(catKey)}
                >
                  <Text style={styles.catEmoji}>{catIcon}</Text>
                  <Text style={[styles.catName, cashCategory === catKey && styles.catNameActive]}>
                    {catLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={saveCashExpense} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.primaryBtnText}>💵 Record Cash Expense</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 5: AI FINANCIAL RECOMMENDATIONS & ADVISORY              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'advice' && (
        <View>
          <AiRecommendationsCard />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  wrap: { padding: 16, paddingBottom: 40 },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    marginBottom: 12,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  backText: { color: theme.accent, fontSize: 13, fontWeight: '700' },
  aiBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  aiBadgeText: { color: theme.accent, fontSize: 11, fontWeight: '800' },
  h1: { color: theme.text, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: theme.textDim, fontSize: 13, marginBottom: 16, lineHeight: 18 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 14,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: theme.accent,
  },
  tabText: {
    color: theme.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: { color: theme.text, fontSize: 17, fontWeight: '800' },
  cardBadge: {
    backgroundColor: '#F1F5F9',
    color: theme.textDim,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardHint: { color: theme.textDim, fontSize: 12, marginBottom: 14, lineHeight: 17 },

  fieldLabel: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 6,
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

  uploadDropZone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.accent,
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginVertical: 10,
  },
  dropZoneIcon: { fontSize: 32, marginBottom: 6 },
  dropZoneTitle: { color: theme.text, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  dropZoneSub: { color: theme.textDim, fontSize: 11, marginTop: 2, marginBottom: 12 },
  btnRow: { flexDirection: 'row', gap: 8 },
  uploadActionBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  uploadActionBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  uploadActionBtnOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.accent,
  },
  uploadActionBtnOutlineText: { color: theme.accent, fontSize: 12, fontWeight: '700' },

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

  resultsBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.border,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultsTitle: { color: theme.text, fontSize: 13, fontWeight: '800' },
  resultsBank: { color: theme.accent, fontSize: 12, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statBoxLabel: { color: theme.textDim, fontSize: 11, fontWeight: '600' },
  statBoxVal: { fontSize: 15, fontWeight: '800', marginTop: 2 },

  txnsSubhead: { color: theme.text, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  stmtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 6,
  },
  stmtDesc: { color: theme.text, fontSize: 12, fontWeight: '700' },
  stmtDate: { color: theme.textDim, fontSize: 10, marginTop: 2 },
  stmtAmt: { fontSize: 12, fontWeight: '800' },

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
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
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

  policyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 8,
  },
  policyTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  policyBadge: {
    backgroundColor: '#FFF7ED',
    color: theme.accent,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  policyStatus: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  policyTitle: { color: theme.text, fontSize: 13, fontWeight: '800' },
  policyProvider: { color: theme.textDim, fontSize: 11, marginTop: 2 },
  policyBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  policyMetric: { color: theme.text, fontSize: 11, fontWeight: '700' },
  policyPremium: { color: theme.accent, fontSize: 11, fontWeight: '700' },

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

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  rupee: { color: theme.accent, fontSize: 26, fontWeight: '800', marginRight: 8 },
  amountInput: { flex: 1, color: theme.text, fontSize: 24, fontWeight: '800' },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  catChipActive: { backgroundColor: '#FFF7ED', borderColor: theme.accent },
  catEmoji: { fontSize: 14 },
  catName: { color: theme.textDim, fontSize: 11, fontWeight: '600' },
  catNameActive: { color: theme.accent, fontWeight: '800' },
});
