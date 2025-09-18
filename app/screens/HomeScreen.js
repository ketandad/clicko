import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  StatusBar,
  RefreshControl,
  Dimensions
} from 'react-native';
import {
  Text,
  Searchbar,
  Card,
  Title,
  ActivityIndicator,
  Surface,
  Chip
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { getCategories, getFeaturedCategories } from '../services/categoryService';
import { colors } from '../theme';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [featuredCategories, setFeaturedCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (categories.length > 0) {
      filterCategories();
    }
  }, [searchQuery, categories]);

  const loadData = async () => {
    try {
      setLoading(true);
      const categoriesData = await getCategories();
      const featuredData = await getFeaturedCategories();
      
      setCategories(categoriesData);
      setFeaturedCategories(featuredData);
      setFilteredCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filterCategories = () => {
    if (!searchQuery.trim()) {
      setFilteredCategories(categories);
      return;
    }
    
    const filtered = categories.filter(category => 
      category.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredCategories(filtered);
  };

  const handleCategorySelect = (category) => {
    navigation.navigate('AgentList', { category });
  };

  const renderFeaturedCategory = ({ item }) => (
    <TouchableOpacity
      style={styles.featuredItem}
      onPress={() => handleCategorySelect(item)}
    >
      <LinearGradient
        colors={[colors.primary, '#3f51b5']}
        style={styles.featuredGradient}
      >
        <Image 
          source={{ uri: item.icon_url || 'https://via.placeholder.com/100' }} 
          style={styles.featuredImage}
        />
        <Text style={styles.featuredTitle}>{item.name}</Text>
        <Text style={styles.featuredSubtitle}>
          {item.agent_count} Agents Available
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderCategory = ({ item }) => (
    <TouchableOpacity
      style={styles.categoryItem}
      onPress={() => handleCategorySelect(item)}
    >
      <Surface style={styles.categorySurface}>
        <Image
          source={{ uri: item.icon_url || 'https://via.placeholder.com/60' }}
          style={styles.categoryImage}
        />
        <Text style={styles.categoryName}>{item.name}</Text>
      </Surface>
    </TouchableOpacity>
  );

  const renderPopularSearch = (tag) => (
    <Chip 
      key={tag} 
      style={styles.chip} 
      onPress={() => setSearchQuery(tag)}
      mode="outlined"
    >
      {tag}
    </Chip>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading services...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <View style={styles.header}>
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Hello, {user?.name || 'there'}!</Text>
          <Text style={styles.subtitleText}>What service do you need today?</Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <MaterialCommunityIcons name="account-circle" size={40} color={colors.primary} />
        </TouchableOpacity>
      </View>
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Searchbar
          placeholder="Search services..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          iconColor={colors.primary}
        />
        
        {searchQuery.length === 0 && (
          <View style={styles.popularSearches}>
            <Text style={styles.sectionTitle}>Popular Searches</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsContainer}>
              {['Electrician', 'Plumber', 'Cleaning', 'AC Repair', 'Carpenter'].map(renderPopularSearch)}
            </ScrollView>
          </View>
        )}
        
        {searchQuery.length === 0 && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Featured Services</Text>
              <FlatList
                data={featuredCategories}
                renderItem={renderFeaturedCategory}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featuredList}
              />
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Services</Text>
            </View>
          </>
        )}
        
        {filteredCategories.length > 0 ? (
          <FlatList
            data={filteredCategories}
            renderItem={renderCategory}
            keyExtractor={(item) => item.id.toString()}
            numColumns={3}
            scrollEnabled={false}
            contentContainerStyle={styles.categoriesList}
          />
        ) : (
          <View style={styles.noResults}>
            <MaterialCommunityIcons name="magnify-close" size={60} color={colors.textSecondary} />
            <Text style={styles.noResultsText}>No services found for "{searchQuery}"</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
  },
  welcomeSection: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitleText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  profileButton: {
    marginLeft: 16,
  },
  searchbar: {
    margin: 16,
    elevation: 2,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  popularSearches: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    paddingBottom: 8,
  },
  chip: {
    marginRight: 8,
    backgroundColor: '#f0f4ff',
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  featuredList: {
    paddingVertical: 8,
  },
  featuredItem: {
    width: width * 0.8,
    height: 160,
    marginRight: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  featuredGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'flex-end',
  },
  featuredImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.2,
  },
  featuredTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  featuredSubtitle: {
    color: '#ffffff',
    fontSize: 14,
    marginTop: 4,
  },
  categoriesList: {
    padding: 8,
  },
  categoryItem: {
    width: width / 3 - 16,
    margin: 8,
  },
  categorySurface: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    elevation: 1,
    backgroundColor: '#ffffff',
    height: 120,
  },
  categoryImage: {
    width: 50,
    height: 50,
    marginBottom: 8,
  },
  categoryName: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.textPrimary,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noResultsText: {
    marginTop: 16,
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
});
