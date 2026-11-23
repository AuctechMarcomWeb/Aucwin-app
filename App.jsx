import { useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { onNotificationTap } from "@/lib/notifications";
import { AuthProvider, useAuth } from "@/lib/auth";
import { QueryProvider, RealtimeSync } from "@/lib/query";
import { C } from "@/components/ui";
import { BrandLogo } from "@/components/Brand";
import { getModuleCounts } from "@/lib/api";
import LoginScreen from "@/screens/LoginScreen";
import DashboardScreen from "@/screens/DashboardScreen";
import LeadsScreen from "@/screens/LeadsScreen";
import LeadDetailScreen from "@/screens/LeadDetailScreen";
import { ClientsScreen, ClientDetailScreen } from "@/screens/ClientsScreen";
import TasksScreen from "@/screens/TasksScreen";
import MoreScreen from "@/screens/MoreScreen";
import DataSourcesScreen from "@/screens/DataSourcesScreen";
import ReportsScreen from "@/screens/ReportsScreen";
import StagesScreen from "@/screens/StagesScreen";
import HomeScreen from "@/screens/HomeScreen";
import CalendarScreen from "@/screens/CalendarScreen";
import {
  ChannelsScreen,
  ThreadScreen,
  ThreadTitle,
} from "@/screens/ChatScreen";
import {
  RemindersScreen,
  MeetingsScreen,
  TodoScreen,
  NotesScreen,
} from "@/screens/ModuleScreens";

const Tab = createBottomTabNavigator();
const LeadsStack = createNativeStackNavigator();
const MoreStack = createNativeStackNavigator();
const ChatStack = createNativeStackNavigator();
// navy page headers, like the website's top bar
const headerStyle = {
  headerStyle: { backgroundColor: C.dark },
  headerTitleStyle: { fontWeight: "800", fontSize: 18, color: "#fff" },
  headerShadowVisible: false,
  headerTintColor: "#fff",
};

function LeadsNav() {
  return (
    <LeadsStack.Navigator screenOptions={headerStyle}>
      <LeadsStack.Screen
        name="LeadsList"
        component={LeadsScreen}
        options={{ title: "Leads" }}
      />
      <LeadsStack.Screen
        name="LeadDetail"
        component={LeadDetailScreen}
        options={{ title: "Lead", headerShown: false }}
      />
    </LeadsStack.Navigator>
  );
}
function MoreNav() {
  return (
    <MoreStack.Navigator screenOptions={headerStyle}>
      <MoreStack.Screen
        name="MoreHome"
        component={MoreScreen}
        options={{ title: "More", headerShown: false }}
      />
      <MoreStack.Screen
        name="Clients"
        component={ClientsScreen}
        options={{ title: "Customers" }}
      />
      <MoreStack.Screen
        name="ClientDetail"
        component={ClientDetailScreen}
        options={{ title: "Customer", headerShown: false }}
      />
      <MoreStack.Screen
        name="Tasks"
        component={TasksScreen}
        options={{ title: "Tasks" }}
      />
      <MoreStack.Screen name="Reminders" component={RemindersScreen} />
      <MoreStack.Screen name="Meetings" component={MeetingsScreen} />
      <MoreStack.Screen
        name="Todo"
        component={TodoScreen}
        options={{ title: "My to-do list" }}
      />
      <MoreStack.Screen name="Notes" component={NotesScreen} />
      <MoreStack.Screen
        name="Overview"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <MoreStack.Screen
        name="DataSources"
        component={DataSourcesScreen}
        options={{ title: "Data Sources" }}
      />
      <MoreStack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: "Reports" }}
      />
      <MoreStack.Screen
        name="Stages"
        component={StagesScreen}
        options={{ title: "Lead Stages" }}
      />
    </MoreStack.Navigator>
  );
}
function ChatNav() {
  return (
    <ChatStack.Navigator screenOptions={headerStyle}>
      <ChatStack.Screen
        name="Channels"
        component={ChannelsScreen}
        options={{ title: "Chat", headerShown: false }}
      />
      <ChatStack.Screen
        name="Thread"
        component={ThreadScreen}
        options={({ route }) => ({
          title: route.params?.title ?? "Chat",
          headerTitle: () => (
            <ThreadTitle
              title={route.params?.title ?? "Chat"}
              type={route.params?.type}
            />
          ),
        })}
      />
    </ChatStack.Navigator>
  );
}

const ICONS = {
  Home: ["home", "home-outline"],
  Leads: ["funnel", "funnel-outline"],
  Chat: ["chatbubble-ellipses", "chatbubble-ellipses-outline"],
  Calendar: ["calendar", "calendar-outline"],
  More: ["grid", "grid-outline"],
};
const NAV_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: C.bg },
};
// dark bottom bar: light icons, coloured pill behind the active tab
const TAB_BG = {
  Home: "rgba(255,255,255,0.14)",
  Leads: "rgba(244,114,182,0.20)",
  Chat: "rgba(251,113,133,0.20)",
  Calendar: "rgba(56,189,248,0.20)",
  More: "rgba(255,255,255,0.14)",
};
const TAB_COLOR = {
  Home: "#FFFFFF",
  Leads: "#F9A8D4",
  Chat: "#FDA4AF",
  Calendar: "#7DD3FC",
  More: "#FFFFFF",
};

const TAB_LABEL = {
  Home: "Home",
  Leads: "Leads",
  Chat: "Chat",
  Calendar: "Calendar",
  More: "More",
};

function Tabs() {
  // keep the tab bar above Android's on-screen buttons / the iPhone home bar
  const insets = useSafeAreaInsets();
  const counts = useQuery({
    queryKey: ["module_counts"],
    queryFn: getModuleCounts,
  });
  const unread = counts.data?.chat ?? 0;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...headerStyle,
        tabBarActiveTintColor: TAB_COLOR[route.name] ?? C.brand,
        tabBarInactiveTintColor: "#7C8BA1",
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 66 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
          backgroundColor: C.dark,
          borderTopWidth: 0,
          shadowColor: C.dark,
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          elevation: 18,
        },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarLabel: ({ focused, color }) => (
          <Text
            style={{
              fontSize: 11,
              fontWeight: focused ? "800" : "600",
              color,
              marginTop: 2,
            }}
          >
            {TAB_LABEL[route.name]}
          </Text>
        ),
        tabBarIcon: ({ focused, color }) => (
          <View
            style={{
              width: 52,
              height: 30,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: focused
                ? (TAB_BG[route.name] ?? C.brandLight)
                : "transparent",
            }}
          >
            <Ionicons
              name={ICONS[route.name][focused ? 0 : 1]}
              size={21}
              color={color}
            />
          </View>
        ),
        tabBarBadge:
          route.name === "Chat" && unread > 0
            ? unread > 99
              ? "99+"
              : unread
            : undefined,
        tabBarBadgeStyle: {
          backgroundColor: "#F43F5E",
          color: "#fff",
          fontSize: 10,
          fontWeight: "800",
          borderWidth: 2,
          borderColor: C.dark,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Leads"
        component={LeadsNav}
        // Leaving Leads resets it to the list, so returning shows all leads, not the last-opened one.
        options={{ headerShown: false, popToTopOnBlur: true }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatNav}
        // Leaving the tab pops the chat stack back to the list, so returning shows the main chat screen, not the last conversation.
        options={{ headerShown: false, popToTopOnBlur: true }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="More"
        component={MoreNav}
        // Same: leaving More resets it to the main menu instead of the last-opened sub-screen.
        options={{ headerShown: false, popToTopOnBlur: true }}
      />
    </Tab.Navigator>
  );
}

function Root() {
  const { session, loading, profile } = useAuth();
  const navRef = useRef(null);

  // Tapping a follow-up push notification opens the Follow-ups tab.
  useEffect(() => {
    return onNotificationTap((data) => {
      if (data?.followup_id) navRef.current?.navigate("Calendar");
    });
  }, []);

  if (loading)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: C.dark,
          gap: 28,
        }}
      >
        <BrandLogo width={230} variant="white" />
        <ActivityIndicator color={C.accent} />
      </View>
    );
  if (!session) return <LoginScreen />;
  if (profile && !profile.is_active) return <LoginScreen />;
  return (
    <NavigationContainer ref={navRef} theme={NAV_THEME}>
      <RealtimeSync />
      <Tabs />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Root />
        </AuthProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
