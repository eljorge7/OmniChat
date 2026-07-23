import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/auth';
import axios from 'axios';
import { Redirect } from 'expo-router';

// Replace with your actual VPS IP or backend URL
const API_URL = 'http://137.184.155.133:3002/api/v1';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, user } = useAuthStore();

  if (user) {
    return <Redirect href="/" />;
  }

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Por favor ingresa usuario y contraseña');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      setTimeout(() => {
        login({ id: '123', name: 'Juan Técnico', email: email, companyId: 'comp-1' }, 'fake-jwt-token');
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setError('Error de conexión o credenciales incorrectas');
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center px-8 bg-slate-50">
      <View className="mb-10 items-center">
        <Text className="text-4xl font-extrabold text-indigo-600 mb-2">OmniChat</Text>
        <Text className="text-slate-500 font-medium">Portal de Técnicos</Text>
      </View>
      
      {error ? <Text className="text-red-500 mb-4 text-center font-bold">{error}</Text> : null}

      <View className="space-y-4">
        <View>
          <Text className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Correo Electrónico</Text>
          <TextInput 
            className="w-full border border-slate-200 rounded-xl bg-white p-4 font-medium text-slate-800"
            placeholder="tecnico@empresa.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View className="mt-4">
          <Text className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Contraseña</Text>
          <TextInput 
            className="w-full border border-slate-200 rounded-xl bg-white p-4 font-medium text-slate-800"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity 
          className="w-full bg-indigo-600 rounded-xl py-4 items-center mt-8 shadow-sm shadow-indigo-200"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-lg">Ingresar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
