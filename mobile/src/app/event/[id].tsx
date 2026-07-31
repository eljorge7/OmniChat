import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/auth';
import { useEventsStore } from '../../store/events';
import axios from 'axios';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MapPin, Clock, ChevronLeft, Navigation, Camera as CameraIcon, FileText } from 'lucide-react-native';
import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { generateServiceTicket } from '../../utils/pdfGenerator';

const API_URL = 'http://137.184.155.133:3002/api/v1';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user, token } = useAuthStore();
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // Camera state
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [comments, setComments] = useState('');
  const cameraRef = useRef<any>(null);

  const { events, updateEventStatus } = useEventsStore();

  useEffect(() => {
    fetchEvent();
  }, [id, events]); // depend on events to re-render if it changes

  const fetchEvent = async () => {
    if (!user) return;
    try {
      const foundEvent = events.find((e) => e.id === id);
      if (foundEvent) {
        setEvent(foundEvent);
        if (foundEvent.photoUris) {
          setPhotoUris(foundEvent.photoUris);
        } else if (foundEvent.photoEvidence) {
          setPhotoUris(foundEvent.photoEvidence.split(',').filter(Boolean));
        }
        if (foundEvent.comments || foundEvent.description) setComments(foundEvent.comments || foundEvent.description);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      let finalPhotoUris = photoUris;
      
      // Si estamos completando y hay fotos nuevas (que son uris locales), subirlas al backend
      if (newStatus === 'COMPLETADO' && photoUris.length > 0) {
        const uploadedUrls = [];
        for (const uri of photoUris) {
          if (uri.startsWith('http://137.184.155.133')) {
             // Ya fue subida previamente (ej: si se vuelve a cargar)
             uploadedUrls.push(uri);
             continue;
          }
          
          const formData = new FormData();
          const filename = uri.split('/').pop() || 'photo.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image`;
          
          formData.append('file', {
            uri,
            name: filename,
            type,
          } as any);

          const uploadRes = await axios.post(`${API_URL}/calendar/evidence/upload`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          
          if (uploadRes.data.url) {
            uploadedUrls.push(uploadRes.data.url);
          }
        }
        finalPhotoUris = uploadedUrls;
      }

      const updateData = {
        status: newStatus,
        description: comments,
        photoEvidence: finalPhotoUris.length > 0 ? finalPhotoUris.join(',') : undefined
      };

      await axios.put(`${API_URL}/calendar/${user?.companyId}/${id}`, updateData);

      updateEventStatus(id as string, newStatus, finalPhotoUris.length > 0 ? finalPhotoUris : undefined, comments);
      
      const updatedEvent = { ...event, status: newStatus, photoUris: finalPhotoUris.length > 0 ? finalPhotoUris : undefined, comments };
      setEvent(updatedEvent);
      setIsCameraActive(false);
      setUpdating(false);

      if (newStatus === 'COMPLETADO') {
         Alert.alert(
           '¡Servicio Finalizado!',
           'El servicio ha sido guardado exitosamente. ¿Qué deseas hacer con el ticket?',
           [
             { text: 'Solo salir', style: 'cancel', onPress: () => router.back() },
             { text: 'Generar PDF', style: 'default', onPress: async () => {
                 await generateServiceTicket(updatedEvent, user?.name || 'Técnico OmniChat');
                 router.back();
               }
             }
           ]
         );
      }
    } catch (err) {
      console.error('Error updating event:', err);
      Alert.alert('Error', 'No se pudo actualizar el servicio');
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-slate-50">
        <Text>Servicio no encontrado.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 p-3 bg-indigo-100 rounded-xl">
          <Text className="text-indigo-700 font-bold">Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isCameraActive) {
    if (!permission?.granted) {
      return (
        <SafeAreaView className="flex-1 justify-center items-center bg-black">
          <Text className="text-white mb-4">Necesitamos permiso para usar la cámara</Text>
          <TouchableOpacity onPress={requestPermission} className="bg-indigo-600 p-4 rounded-xl">
            <Text className="text-white font-bold">Dar Permiso</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView className="flex-1 bg-black">
        <View style={{ flex: 1 }}>
          <CameraView style={{ flex: 1 }} facing="back" ref={cameraRef} />
          
          <View className="absolute bottom-10 left-0 right-0 flex-row justify-center items-end bg-transparent">
            <TouchableOpacity 
              className="bg-white p-5 rounded-full"
              onPress={async () => {
                if (cameraRef.current) {
                  const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
                  if (photo) {
                    setPhotoUris((prev) => [...prev, photo.uri]);
                    setIsCameraActive(false);
                  }
                }
              }}
            >
              <CameraIcon size={32} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="px-4 py-4 flex-row items-center border-b border-slate-200 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
          <ChevronLeft size={24} color="#334155" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-slate-800" numberOfLines={1}>{event.title}</Text>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView className="flex-1 p-6" keyboardShouldPersistTaps="handled">
          <View className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6">
            <Text className="text-sm text-indigo-600 font-bold mb-2 uppercase tracking-widest">
              Estado Actual: {event.status || 'Programado'}
            </Text>
            
            <View className="flex-row items-center mb-4 mt-2">
              <Clock size={20} color="#64748b" style={{ marginRight: 12 }} />
              <View>
                <Text className="text-slate-500 font-medium text-xs">HORARIO</Text>
                <Text className="text-slate-800 font-bold text-base">
                  {format(new Date(event.startTime), "HH:mm")} - {format(new Date(event.endTime), "HH:mm")}
                </Text>
              </View>
            </View>

            {event.location && (
              <View className="flex-row items-center mb-4">
                <MapPin size={20} color="#64748b" style={{ marginRight: 12 }} />
                <View className="flex-1">
                  <Text className="text-slate-500 font-medium text-xs">UBICACIÓN</Text>
                  <Text className="text-slate-800 font-bold text-base leading-tight">
                    {event.location}
                  </Text>
                </View>
              </View>
            )}
            
            {event.description && (
              <View className="mt-4 p-4 bg-slate-50 rounded-2xl">
                <Text className="text-slate-700 font-medium">{event.description}</Text>
              </View>
            )}
          </View>

          <Text className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 ml-2">Actualizar Estatus</Text>
          
          <View className="space-y-3">
            <TouchableOpacity 
              disabled={updating}
              onPress={() => handleUpdateStatus('EN_CAMINO')}
              className={`p-4 rounded-2xl flex-row items-center justify-center shadow-sm ${event.status === 'EN_CAMINO' ? 'bg-yellow-500 shadow-yellow-200' : 'bg-white border border-slate-200'}`}
            >
              <Navigation size={20} color={event.status === 'EN_CAMINO' ? '#fff' : '#eab308'} style={{ marginRight: 8 }} />
              <Text className={`font-bold text-lg ${event.status === 'EN_CAMINO' ? 'text-white' : 'text-slate-700'}`}>En Camino</Text>
            </TouchableOpacity>

            <TouchableOpacity 
               disabled={updating}
              onPress={() => handleUpdateStatus('TRABAJANDO')}
              className={`p-4 rounded-2xl flex-row items-center justify-center shadow-sm ${event.status === 'TRABAJANDO' ? 'bg-blue-500 shadow-blue-200' : 'bg-white border border-slate-200'}`}
            >
              <Text className={`font-bold text-lg ${event.status === 'TRABAJANDO' ? 'text-white' : 'text-slate-700'}`}>Trabajando (En Sitio)</Text>
            </TouchableOpacity>

            {event.status === 'TRABAJANDO' || event.status === 'COMPLETADO' ? (
              <View className="my-4">
                <Text className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Notas del Técnico</Text>
                <TextInput 
                  className="w-full border border-slate-200 rounded-xl bg-white p-4 font-medium text-slate-800"
                  placeholder="Escribe observaciones o comentarios aquí..."
                  value={comments}
                  onChangeText={setComments}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={event.status !== 'COMPLETADO'}
                />
              </View>
            ) : null}

            {photoUris.length > 0 && (
              <View className="my-4">
                <Text className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest ml-2">Evidencia Fotográfica ({photoUris.length}/4)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  {photoUris.map((uri, index) => (
                    <View key={index} className="mr-3 relative">
                      <Image source={{ uri }} className="w-32 h-32 rounded-xl" />
                      {event.status !== 'COMPLETADO' && (
                        <TouchableOpacity 
                          onPress={() => setPhotoUris((prev) => prev.filter((_, i) => i !== index))}
                          className="absolute -top-2 -right-2 bg-red-500 w-6 h-6 rounded-full items-center justify-center border-2 border-white"
                        >
                          <Text className="text-white text-xs font-bold">×</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  
                  {event.status !== 'COMPLETADO' && photoUris.length < 4 && (
                    <TouchableOpacity 
                      onPress={() => setIsCameraActive(true)}
                      className="w-32 h-32 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 items-center justify-center"
                    >
                      <CameraIcon size={24} color="#94a3b8" />
                      <Text className="text-slate-500 font-medium text-xs mt-2">Agregar</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}

            {event.status === 'COMPLETADO' ? (
              <TouchableOpacity 
                onPress={() => generateServiceTicket({ ...event, photoUris, comments }, user?.name || 'Técnico OmniChat')}
                className="p-4 rounded-2xl flex-row items-center justify-center shadow-sm mt-4 bg-indigo-600 shadow-indigo-200"
              >
                <FileText size={20} color="white" style={{ marginRight: 8 }} />
                <Text className="font-bold text-lg text-white">
                  Generar Ticket PDF
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                 disabled={updating}
                onPress={() => {
                  if (photoUris.length === 0 && event.status !== 'COMPLETADO') {
                    setIsCameraActive(true);
                  } else {
                    handleUpdateStatus('COMPLETADO');
                  }
                }}
                className={`p-4 rounded-2xl flex-row items-center justify-center shadow-sm mt-4 ${event.status === 'COMPLETADO' ? 'bg-green-500 shadow-green-200' : 'bg-green-600 shadow-green-200'}`}
              >
                {updating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-bold text-lg text-white">
                    {photoUris.length > 0 ? 'Finalizar y Subir Evidencias' : 'Marcar Completado'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          <View className="h-20" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
