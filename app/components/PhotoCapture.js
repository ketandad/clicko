import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Text, Button, Card, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { uploadImage } from '../services/imageUploadService';

const PhotoCapture = ({ 
  value, 
  onPhotoSelect,
  onPhotoUpload,
  onImageTaken, // New prop for onboarding cache mode
  title = 'Profile Photo',
  subtitle = 'Add your profile picture',
  type = 'profile', // 'profile' | 'selfie' | 'document'
  required = false,
  disabled = false,
  cacheOnly = false, // New prop to disable API uploads during onboarding
  style,
  ...props 
}) => {
  const [uploading, setUploading] = useState(false);
  const [imageUri, setImageUri] = useState(value);

  // Update imageUri when value prop changes
  React.useEffect(() => {
    setImageUri(value);
  }, [value]);

  const requestPermissions = async () => {
    try {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      return {
        camera: cameraPermission.status === 'granted',
        mediaLibrary: mediaLibraryPermission.status === 'granted'
      };
    } catch (error) {
      console.error('Permission request error:', error);
      return { camera: false, mediaLibrary: false };
    }
  };

  const compressImage = async (uri) => {
    try {
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [
          { resize: { width: type === 'selfie' ? 800 : 600 } }
        ],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      
      return manipulatedImage;
    } catch (error) {
      console.error('Image compression error:', error);
      throw new Error('Failed to process image');
    }
  };

  const uploadImageFile = async (imageUri) => {
    try {
      setUploading(true);
      
      // Compress image first
      const compressedImage = await compressImage(imageUri);
      
      // Upload to backend (implement this service)
      const uploadResult = await uploadImage(compressedImage.uri, type);
      
      if (uploadResult.success) {
        setImageUri(uploadResult.url);
        onPhotoSelect && onPhotoSelect(uploadResult.url, uploadResult);
        onPhotoUpload && onPhotoUpload(uploadResult.url, uploadResult);
        return uploadResult;
      } else {
        throw new Error(uploadResult.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Image upload error:', error);
      Alert.alert('Upload Error', error.message || 'Failed to upload image');
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const takePhoto = async () => {
    try {
      const permissions = await requestPermissions();
      
      if (!permissions.camera) {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access to take photos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'selfie' ? [1, 1] : [4, 3],
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        
        if (cacheOnly) {
          // Cache mode - just save URI locally, no API upload
          const compressedImage = await compressImage(asset.uri);
          setImageUri(compressedImage.uri);
          onImageTaken && onImageTaken(compressedImage.uri);
          console.log('📸 Image cached locally during onboarding:', compressedImage.uri);
        } else {
          // Normal mode - upload to API
          await uploadImageFile(asset.uri);
        }
      }
    } catch (error) {
      console.error('Take photo error:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickFromGallery = async () => {
    try {
      const permissions = await requestPermissions();
      
      if (!permissions.mediaLibrary) {
        Alert.alert(
          'Gallery Permission Required',
          'Please enable photo library access to select images.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'selfie' ? [1, 1] : [4, 3],
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        
        if (cacheOnly) {
          // Cache mode - just save URI locally, no API upload
          const compressedImage = await compressImage(asset.uri);
          setImageUri(compressedImage.uri);
          onImageTaken && onImageTaken(compressedImage.uri);
          console.log('📸 Image cached locally during onboarding:', compressedImage.uri);
        } else {
          // Normal mode - upload to API
          await uploadImageFile(asset.uri);
        }
      }
    } catch (error) {
      console.error('Pick image error:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(
      'Select Photo',
      'Choose how you want to add your photo',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickFromGallery },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const removePhoto = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            setImageUri(null);
            onPhotoSelect && onPhotoSelect(null);
          }
        }
      ]
    );
  };

  const getIconName = () => {
    switch (type) {
      case 'selfie':
        return 'account-circle';
      case 'document':
        return 'file-document';
      default:
        return 'camera';
    }
  };

  const getPlaceholderText = () => {
    switch (type) {
      case 'selfie':
        return 'Take a selfie for verification';
      case 'document':
        return 'Upload document photo';
      default:
        return 'Add profile picture';
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      
      <Card style={styles.photoCard}>
        <TouchableOpacity 
          style={styles.photoContainer}
          onPress={imageUri ? undefined : showPhotoOptions}
          disabled={disabled || uploading}
        >
          {uploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          ) : imageUri ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.image} />
              <View style={styles.imageOverlay}>
                <IconButton
                  icon="pencil"
                  iconColor="#FFFFFF"
                  size={20}
                  onPress={showPhotoOptions}
                  style={styles.editButton}
                />
                <IconButton
                  icon="delete"
                  iconColor="#FFFFFF"
                  size={20}
                  onPress={removePhoto}
                  style={styles.deleteButton}
                />
              </View>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <MaterialCommunityIcons 
                name={getIconName()} 
                size={48} 
                color="#CCCCCC" 
              />
              <Text style={styles.placeholderText}>
                {getPlaceholderText()}
              </Text>
              <Button 
                mode="outlined" 
                onPress={showPhotoOptions}
                style={styles.addButton}
                disabled={disabled}
              >
                Add Photo
              </Button>
            </View>
          )}
        </TouchableOpacity>
      </Card>

      {required && !imageUri && (
        <Text style={styles.requiredText}>* Photo is required</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  photoCard: {
    elevation: 2,
  },
  photoContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
  },
  editButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    margin: 4,
  },
  deleteButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    margin: 4,
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 20,
  },
  addButton: {
    marginTop: 8,
  },
  requiredText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 4,
  },
});

export default PhotoCapture;