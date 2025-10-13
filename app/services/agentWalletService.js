/**
 * Agent Wallet Service
 * Frontend service for wallet operations and balance management
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

class AgentWalletService {
    constructor() {
        this.baseUrl = 'http://localhost:8000';
        this.minimumBalance = 20.0;
    }

    /**
     * Get agent wallet balance and status
     */
    async getWalletBalance(agentId) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${this.baseUrl}/wallet/balance/${agentId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to get wallet balance');
            }

            const balance = await response.json();
            console.log('💳 Wallet balance retrieved:', balance);
            return balance;

        } catch (error) {
            console.error('Error getting wallet balance:', error);
            throw error;
        }
    }

    /**
     * Get comprehensive wallet summary
     */
    async getWalletSummary(agentId) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${this.baseUrl}/wallet/summary/${agentId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to get wallet summary');
            }

            return await response.json();

        } catch (error) {
            console.error('Error getting wallet summary:', error);
            throw error;
        }
    }

    /**
     * Check if agent can accept bookings based on wallet balance
     */
    async canAcceptBookings(agentId, useCache = true) {
        try {
            let currentBalance = 1000;
            let canAccept = true;
            let minimumRequired = this.minimumBalance;
            
            if (useCache) {
                // Use cached balance to avoid network calls
                currentBalance = await this.getCachedWalletBalance();
                canAccept = currentBalance >= minimumRequired;
                console.log('💳 Checking booking eligibility with cached balance:', currentBalance);
            } else {
                // For actual booking flow, try to get real balance
                const balance = await this.getWalletBalance(agentId);
                currentBalance = balance.current_balance;
                canAccept = balance.can_accept_bookings;
                minimumRequired = balance.minimum_required;
            }
            
            return {
                canAccept: canAccept,
                currentBalance: currentBalance,
                minimumRequired: minimumRequired,
                needsRecharge: !canAccept,
                reason: canAccept ? 
                    'Sufficient balance' : 
                    `Insufficient balance (₹${currentBalance} < ₹${minimumRequired})`
            };

        } catch (error) {
            console.error('Error checking booking eligibility:', error);
            // Default to allowing bookings with cached balance
            const cachedBalance = await this.getCachedWalletBalance();
            const canAccept = cachedBalance >= this.minimumBalance;
            return {
                canAccept: canAccept,
                currentBalance: cachedBalance,
                minimumRequired: this.minimumBalance,
                needsRecharge: !canAccept,
                reason: canAccept ? 'Using cached balance' : 'Error checking balance - using cached data'
            };
        }
    }

    /**
     * Charge booking fee when agent accepts booking
     */
    async chargeBookingFee(agentId, bookingId, description = null) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${this.baseUrl}/wallet/charge-booking-fee`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    booking_id: bookingId,
                    description: description || `Booking fee for booking ${bookingId}`
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to charge booking fee');
            }

            const result = await response.json();
            console.log('💸 Booking fee charged:', result);
            return result;

        } catch (error) {
            console.error('Error charging booking fee:', error);
            throw error;
        }
    }

    /**
     * Process refund when booking is cancelled
     */
    async processRefund(agentId, bookingId, reason) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${this.baseUrl}/wallet/process-refund`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    booking_id: bookingId,
                    reason: reason
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to process refund');
            }

            const result = await response.json();
            console.log('💰 Refund processed:', result);
            return result;

        } catch (error) {
            console.error('Error processing refund:', error);
            throw error;
        }
    }

    /**
     * Get wallet transaction history
     */
    async getTransactionHistory(agentId, options = {}) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const queryParams = new URLSearchParams({
                limit: options.limit || 50,
                offset: options.offset || 0,
                ...(options.transactionType && { transaction_type: options.transactionType })
            });
            
            const response = await fetch(`${this.baseUrl}/wallet/transactions/${agentId}?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to get transaction history');
            }

            return await response.json();

        } catch (error) {
            console.error('Error getting transaction history:', error);
            throw error;
        }
    }

    /**
     * Get wallet alerts
     */
    async getWalletAlerts(agentId, unreadOnly = false) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const queryParams = new URLSearchParams({
                ...(unreadOnly && { unread_only: true })
            });
            
            const response = await fetch(`${this.baseUrl}/wallet/alerts/${agentId}?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to get wallet alerts');
            }

            return await response.json();

        } catch (error) {
            console.error('Error getting wallet alerts:', error);
            throw error;
        }
    }

    /**
     * Mark alert as read
     */
    async markAlertAsRead(alertId) {
        try {
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${this.baseUrl}/wallet/mark-alert-read/${alertId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to mark alert as read');
            }

            return await response.json();

        } catch (error) {
            console.error('Error marking alert as read:', error);
            throw error;
        }
    }

    /**
     * Format balance amount for display
     */
    formatBalance(amount) {
        return `₹${Math.abs(amount).toFixed(2)}`;
    }

    /**
     * Get balance status info for UI
     */
    getBalanceStatus(balance, minimumBalance = this.minimumBalance) {
        if (balance >= minimumBalance * 2) {
            return {
                status: 'good',
                color: '#28a745',
                icon: '💰',
                message: 'Good balance'
            };
        } else if (balance >= minimumBalance) {
            return {
                status: 'low',
                color: '#ffc107',
                icon: '⚠️',
                message: 'Low balance - consider recharging'
            };
        } else {
            return {
                status: 'critical',
                color: '#dc3545',
                icon: '🚨',
                message: 'Insufficient balance - cannot accept bookings'
            };
        }
    }

    /**
     * Get transaction type display info
     */
    getTransactionTypeInfo(transactionType) {
        const typeMap = {
            'booking_fee': {
                label: 'Booking Fee',
                icon: '📋',
                color: '#dc3545',
                description: 'Fee charged for accepting booking'
            },
            'refund': {
                label: 'Refund',
                icon: '💰',
                color: '#28a745',
                description: 'Refund for cancelled booking'
            },
            'recharge': {
                label: 'Recharge',
                icon: '🔋',
                color: '#007bff',
                description: 'Wallet top-up'
            },
            'bonus': {
                label: 'Bonus',
                icon: '🎉',
                color: '#28a745',
                description: 'Bonus credit'
            },
            'penalty': {
                label: 'Penalty',
                icon: '⚠️',
                color: '#dc3545',
                description: 'Penalty deduction'
            },
            'adjustment': {
                label: 'Adjustment',
                icon: '⚖️',
                color: '#6c757d',
                description: 'Manual balance adjustment'
            }
        };

        return typeMap[transactionType] || {
            label: transactionType,
            icon: '❓',
            color: '#6c757d',
            description: 'Unknown transaction type'
        };
    }

    /**
     * Calculate monthly statistics summary
     */
    calculateMonthlySummary(monthlyStats) {
        const { transaction_count, total_spent, total_received, net_amount } = monthlyStats;
        
        return {
            totalTransactions: transaction_count || 0,
            totalSpent: Math.abs(total_spent || 0),
            totalReceived: total_received || 0,
            netAmount: net_amount || 0,
            formattedSpent: this.formatBalance(total_spent || 0),
            formattedReceived: this.formatBalance(total_received || 0),
            formattedNet: this.formatBalance(net_amount || 0),
            netStatus: (net_amount || 0) >= 0 ? 'positive' : 'negative'
        };
    }

    /**
     * Check if agent should be forced offline due to low balance
     */
    async shouldBeOffline(agentId) {
        try {
            const eligibility = await this.canAcceptBookings(agentId);
            return {
                shouldBeOffline: !eligibility.canAccept,
                reason: eligibility.reason,
                currentBalance: eligibility.currentBalance
            };

        } catch (error) {
            console.error('Error checking offline status:', error);
            return {
                shouldBeOffline: true,
                reason: 'Error checking wallet balance'
            };
        }
    }

    /**
     * Get cached wallet balance from local storage
     */
    async getCachedWalletBalance() {
        try {
            const cachedBalance = await AsyncStorage.getItem('agent_wallet_balance');
            return cachedBalance ? parseFloat(cachedBalance) : 1000; // Default to 1000 if not cached
        } catch (error) {
            console.log('No cached balance found, using default:', 1000);
            return 1000; // Default onboarding balance
        }
    }

    /**
     * Cache wallet balance locally
     */
    async setCachedWalletBalance(balance) {
        try {
            await AsyncStorage.setItem('agent_wallet_balance', balance.toString());
        } catch (error) {
            console.warn('Failed to cache wallet balance:', error);
        }
    }

    /**
     * Get wallet status for agent dashboard (uses cached data for home screen)
     */
    async getWalletStatus(agentId, useCache = true) {
        try {
            let currentBalance = 1000; // Default onboarding balance
            
            if (useCache) {
                // Use cached balance for home screen to avoid network calls
                currentBalance = await this.getCachedWalletBalance();
                console.log('💳 Using cached wallet balance:', currentBalance);
            } else {
                // For actual transactions, try to get real balance from API
                try {
                    const balanceResponse = await this.getWalletBalance(agentId);
                    currentBalance = balanceResponse.current_balance;
                    // Cache the fresh balance
                    await this.setCachedWalletBalance(currentBalance);
                } catch (networkError) {
                    console.log('Network call failed, falling back to cached balance');
                    currentBalance = await this.getCachedWalletBalance();
                }
            }

            const balanceStatus = this.getBalanceStatus(currentBalance);
            const canAcceptBookings = currentBalance >= this.minimumBalance;
            
            return {
                balance: currentBalance,
                formattedBalance: this.formatBalance(currentBalance),
                canAcceptBookings: canAcceptBookings,
                needsRecharge: !canAcceptBookings,
                balanceStatus: balanceStatus,
                unreadAlerts: 0, // Default to 0 for cached mode
                criticalAlerts: 0
            };

        } catch (error) {
            console.error('Error getting wallet status:', error);
            // Return default state with onboarding balance
            const defaultBalance = 1000;
            const balanceStatus = this.getBalanceStatus(defaultBalance);
            
            return {
                balance: defaultBalance,
                formattedBalance: this.formatBalance(defaultBalance),
                canAcceptBookings: true,
                needsRecharge: false,
                balanceStatus: balanceStatus,
                unreadAlerts: 0,
                criticalAlerts: 0
            };
        }
    }

    /**
     * Check if agent should be offline based on wallet balance
     */
    async shouldBeOffline(agentId, useCache = true) {
        try {
            const eligibility = await this.canAcceptBookings(agentId, useCache);
            console.log('💳 Offline check with cached data:', eligibility);
            return {
                shouldBeOffline: !eligibility.canAccept,
                reason: eligibility.reason,
                currentBalance: eligibility.currentBalance
            };

        } catch (error) {
            console.error('Error checking offline status:', error);
            // Default to allowing online status with cached balance
            const cachedBalance = await this.getCachedWalletBalance();
            return {
                shouldBeOffline: cachedBalance < this.minimumBalance,
                reason: cachedBalance >= this.minimumBalance ? 'Using cached balance' : 'Insufficient cached balance',
                currentBalance: cachedBalance
            };
        }
    }
}

// Export singleton instance
export default new AgentWalletService();