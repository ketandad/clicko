import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Button,
  ActivityIndicator,
  Searchbar,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { getAgentsByCategory } from '../services/agentListService';
import { getSubCategories } from '../services/subCategoryService';
import { colors } from '../theme';
import AgentCard from '../components/AgentCard';

export default function CategoryScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { categoryId, categoryName, hasSubCategories } = route.params || {};

  const [agents, setAgents] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
  }, [categoryId]);

  useEffect(() => {
    loadSubCategories();
  }, [categoryId, hasSubCategories]);

  const loadData = async () => {
    if (!categoryId) return;
    
    try {
      setLoading(true);
      const agentsData = await getAgentsByCategory(categoryId);
      setAgents(agentsData);
    } catch (error) {
      console.error('❌ Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubCategories = async () => {
    if (!categoryId || !hasSubCategories) return;
    
    try {
      const subCategoriesData = await getSubCategories(categoryId);
      setSubCategories(subCategoriesData);
    } catch (error) {
      console.error('❌ Failed to load sub-categories:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const toggleSubCategory = (subCategoryId) => {
    setSelectedSubCategories(prev => 
      prev.includes(subCategoryId)
        ? prev.filter(id => id !== subCategoryId)
        : [...prev, subCategoryId]
    );
  };

  const clearFilters = () => {
    setSelectedSubCategories([]);
    setSearchQuery('');
  };

  const filteredAgents = agents.filter(agent => {
    // Filter by search query
    const matchesSearch = !searchQuery || 
      agent.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.bio?.toLowerCase().includes(searchQuery.toLowerCase());

    // Filter by sub-categories (if any selected)
    const matchesSubCategory = selectedSubCategories.length === 0 || 
      selectedSubCategories.some(subCatId => 
        agent.sub_categories?.some(agentSubCat => agentSubCat.id === subCatId)
      );

    return matchesSearch && matchesSubCategory;
  });

  const renderAgent = ({ item }) => (
    <AgentCard
      agent={item}
      onPress={() => navigation.navigate('AgentProfile', { agentId: item.id })}
      onBookPress={() => navigation.navigate('BookingScreen', { 
        agentId: item.id, 
        categoryId: categoryId 
      })}
    />
  );

  const renderSubCategoryFilters = () => {
    if (!hasSubCategories || subCategories.length === 0) return null;

    return (
      <Card style={styles.filtersCard}>
        <Card.Content>
          <View style={styles.filtersHeader}>
            <Text style={styles.filtersTitle}>Filter by Specialization</Text>
            <Button
              mode="text"
              onPress={() => setShowFilters(!showFilters)}
              icon={showFilters ? 'chevron-up' : 'chevron-down'}
            >
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </View>

          {showFilters && (
            <View>
              <View style={styles.subCategoriesContainer}>
                {subCategories.map((subCategory) => (
                  <Chip
                    key={subCategory.id}
                    style={[
                      styles.subCategoryChip,
                      selectedSubCategories.includes(subCategory.id) && styles.selectedSubCategoryChip
                    ]}
                    selected={selectedSubCategories.includes(subCategory.id)}
                    onPress={() => toggleSubCategory(subCategory.id)}
                    mode={selectedSubCategories.includes(subCategory.id) ? 'flat' : 'outlined'}
                  >
                    {subCategory.name}
                  </Chip>
                ))}
              </View>

              {selectedSubCategories.length > 0 && (
                <View style={styles.filterActions}>
                  <Text style={styles.filterCount}>
                    {selectedSubCategories.length} filter(s) applied
                  </Text>
                  <Button mode="outlined" onPress={clearFilters}>
                    Clear Filters
                  </Button>
                </View>
              )}
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading agents...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{categoryName || 'Category'}</Text>
        <Text style={styles.headerSubtitle}>
          {filteredAgents.length} agent(s) available
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Searchbar
          placeholder="Search agents..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        {renderSubCategoryFilters()}

        {filteredAgents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons 
              name="account-search" 
              size={64} 
              color="#ccc" 
            />
            <Text style={styles.emptyTitle}>No agents found</Text>
            <Text style={styles.emptyDescription}>
              {selectedSubCategories.length > 0 || searchQuery
                ? 'Try adjusting your filters or search query'
                : 'No agents are currently available in this category'
              }
            </Text>
            {(selectedSubCategories.length > 0 || searchQuery) && (
              <Button mode="outlined" onPress={clearFilters} style={styles.clearButton}>
                Clear Filters
              </Button>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredAgents}
            renderItem={renderAgent}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.agentsList}
            scrollEnabled={false}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: colors.primary,
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
  },
  filtersCard: {
    margin: 16,
    marginTop: 8,
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  subCategoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  subCategoryChip: {
    marginBottom: 8,
  },
  selectedSubCategoryChip: {
    backgroundColor: colors.primary,
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  filterCount: {
    fontSize: 14,
    color: '#666',
  },
  agentsList: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  clearButton: {
    marginTop: 20,
  },
});
