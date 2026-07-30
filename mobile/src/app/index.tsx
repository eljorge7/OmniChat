import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/auth';
import axios from 'axios';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useEventsStore } from '../store/events';
import { MapPin, Clock, Calendar as CalendarIcon, LogOut } from 'lucide-react-native';
import { useRouter, Redirect } from 'expo-router';

const API_URL = 'http://137.184.155.133:3002/api/v1';

export default function AgendaScreen() {
  const { user, token, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  if (!user) {
    return <Redirect href="/login" />;
  }

  const { events, setEvents } = useEventsStore();

  const fetchAgenda = useCallback(async () => {
    if (!user || !user.companyId || !user.id) return;
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/calendar/${user.companyId}?assignedToId=${user.id}`);
      setEvents(res.data);
    } catch (err) {
      console.error('Error fetching agenda:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAgenda();
  }, [fetchAgenda]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAgenda();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'EN_CAMINO': return 'bg-yellow-500';
      case 'TRABAJANDO': return 'bg-blue-500';
      case 'COMPLETADO': return 'bg-green-500';
      default: return 'bg-slate-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'EN_CAMINO': return 'En Camino';
      case 'TRABAJANDO': return 'Trabajando';
      case 'COMPLETADO': return 'Completado';
      default: return 'Programado';
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-slate-100 active:bg-slate-50"
      onPress={() => router.push(`/event/${item.id}`)}
    >
      <View className="flex-row justify-between items-start mb-3">
        <Text className="text-lg font-bold text-slate-800 flex-1 mr-4">{item.title}</Text>
        <View className={`px-3 py-1 rounded-full ${getStatusColor(item.status)}`}>
          <Text className="text-white text-xs font-bold">{getStatusLabel(item.status)}</Text>
        </View>
      </View>
      
      <View className="flex-row items-center mb-2">
        <Clock size={16} color="#64748b" style={{ marginRight: 8 }} />
        <Text className="text-slate-500 font-medium">
          {format(new Date(item.startTime), "HH:mm")} - {format(new Date(item.endTime), "HH:mm")}
        </Text>
      </View>

      {item.location && (
        <View className="flex-row items-center">
          <MapPin size={16} color="#64748b" style={{ marginRight: 8 }} />
          <Text className="text-slate-500 font-medium flex-1">{item.location}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="px-6 py-4 flex-row justify-between items-center bg-white border-b border-slate-200 shadow-sm">
        <View>
          <Text className="text-2xl font-black text-slate-800">Mi Agenda</Text>
          <Text className="text-indigo-600 font-bold">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</Text>
        </View>
        <TouchableOpacity onPress={logout} className="p-2 bg-slate-100 rounded-full">
          <LogOut size={20} color="#64748b" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <CalendarIcon size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
              <Text className="text-slate-500 text-lg font-medium">No tienes servicios asignados hoy</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
