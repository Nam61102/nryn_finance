import { Tabs, router } from 'expo-router';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { theme } from '../../theme';

/** Home · Category · (+) · Budget · Profile — five is the limit before the bar
 *  gets cramped, so the full list and analytics are pushed screens. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 6,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textDim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🏠</Text> }} />
      <Tabs.Screen name="categories" options={{ title: 'Category', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🗂️</Text> }} />
      <Tabs.Screen
        name="add-placeholder"
        options={{
          title: '',
          tabBarButton: () => (
            <TouchableOpacity style={styles.fabWrap} onPress={() => router.push('/add')} activeOpacity={0.85}>
              <View style={styles.fab}><Text style={styles.fabText}>+</Text></View>
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen name="budgets" options={{ title: 'Budget', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🎯</Text> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👤</Text> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fabWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    shadowColor: theme.accent,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', marginTop: -3 },
});
