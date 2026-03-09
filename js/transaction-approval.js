/**
 * 📋 Transaction Approval System
 * Alıcı-Satıcı işlem onay yönetimi ve değerlendirme kontrolü
 */

import { sanitizeHTML, sanitizeText } from './xss-protection.js';
import logger from './logger.js';

export class TransactionApprovalManager {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
     * Alıcı-Satıcı konuşmasından işlem onayı oluştur veya getir
     */
    async getOrCreateApproval(listingId, buyerId, sellerId, conversationId = null) {
        try {
            // Mevcut onayı kontrol et
            const { data: existing, error: checkError } = await this.supabase
                .from('transaction_approvals')
                .select('*')
                .eq('listing_id', listingId)
                .eq('buyer_id', buyerId)
                .eq('seller_id', sellerId);

            // Zaten varsa döndür
            if (existing && existing.length > 0) {
                return existing[0];
            }

            // Yeni onay oluştur
            const { data: newApproval, error: createError } = await this.supabase
                .from('transaction_approvals')
                .insert({
                    listing_id: listingId,
                    buyer_id: buyerId,
                    seller_id: sellerId,
                    conversation_id: conversationId
                })
                .select();

            if (createError) {
                // Eğer duplicate key hatası alırsa, zaten var demek - yeniden getir
                if (createError.code === '23505') {
                    const { data: retry } = await this.supabase
                        .from('transaction_approvals')
                        .select('*')
                        .eq('listing_id', listingId)
                        .eq('buyer_id', buyerId)
                        .eq('seller_id', sellerId);
                    
                    if (retry && retry.length > 0) return retry[0];
                }
                throw createError;
            }

            return newApproval && newApproval.length > 0 ? newApproval[0] : null;
        } catch (error) {
            logger.error('Transaction approval creation error', error);
            throw error;
        }
    }

    /**
     * Alıcı/Satıcı onayını güncelle
     */
    async updateApproval(approvalId, isApprovedByBuyer = null, isApprovedBySeller = null) {
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            if (!user) throw new Error('User not found');

            // Mevcut onayı getir
            const { data: approval, error: fetchError } = await this.supabase
                .from('transaction_approvals')
                .select('*')
                .eq('id', approvalId);

            if (fetchError || !approval || approval.length === 0) throw fetchError || new Error('Approval not found');

            const currentApproval = approval[0];
            const updateData = {
                updated_at: new Date().toISOString()
            };

            // Alıcı onayını güncelle
            if (isApprovedByBuyer !== null && user.id === currentApproval.buyer_id) {
                updateData.buyer_approved = isApprovedByBuyer;
                updateData.buyer_approved_at = isApprovedByBuyer ? new Date().toISOString() : null;
            }

            // Satıcı onayını güncelle
            if (isApprovedBySeller !== null && user.id === currentApproval.seller_id) {
                updateData.seller_approved = isApprovedBySeller;
                updateData.seller_approved_at = isApprovedBySeller ? new Date().toISOString() : null;
            }

            const { data: updated, error: updateError } = await this.supabase
                .from('transaction_approvals')
                .update(updateData)
                .eq('id', approvalId)
                .select();

            if (updateError) throw updateError;
            return updated && updated.length > 0 ? updated[0] : null;
        } catch (error) {
            logger.error('Approval update error', error);
            throw error;
        }
    }

    /**
     * İşlem tamamlandı mı kontrol et
     */
    async isTransactionCompleted(approvalId) {
        try {
            const { data: approval, error } = await this.supabase
                .from('transaction_approvals')
                .select('transaction_completed, buyer_approved, seller_approved')
                .eq('id', approvalId);

            if (error || !approval || approval.length === 0) return false;
            
            const app = approval[0];
            return app.transaction_completed && app.buyer_approved && app.seller_approved;
        } catch (error) {
            logger.error('Transaction status check error', error);
            return false;
        }
    }

    /**
     * Kullanıcı bu ürün için değerlendirme yapabilir mi kontrol et
     */
    async canUserRate(listingId, sellerId, userId) {
        try {
            // İşlem onayını kontrol et
            const { data: approval, error } = await this.supabase
                .from('transaction_approvals')
                .select('*')
                .eq('listing_id', listingId)
                .eq('seller_id', sellerId)
                .eq('buyer_id', userId)
                .eq('transaction_completed', true);

            if (error || !approval || approval.length === 0) {
                return {
                    canRate: false,
                    reason: 'Transaction not yet completed or approved'
                };
            }

            return {
                canRate: true,
                approvalId: approval[0].id
            };
        } catch (error) {
            logger.error('Değerlendirme kontrol hatası', error);
            return {
                canRate: false,
                reason: 'An error occurred'
            };
        }
    }

    /**
     * Onaylanan işlemler listesini getir
     */
    async getUserApprovals(userId) {
        try {
            const { data: approvals, error } = await this.supabase
                .from('transaction_approvals')
                .select(`
                    *,
                    listings(id, title, image_url, price),
                    buyer:buyer_id(full_name, id),
                    seller:seller_id(full_name, id)
                `)
                .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return approvals || [];
        } catch (error) {
            logger.error('User approvals fetch error', error);
            return [];
        }
    }

    /**
     * İşlem tamamlandı olarak işaretle (her iki taraf onayladığında)
     */
    async completeTransaction(approvalId) {
        try {
            const { data: approval, error: fetchError } = await this.supabase
                .from('transaction_approvals')
                .select('*')
                .eq('id', approvalId);

            if (fetchError || !approval || approval.length === 0) throw fetchError || new Error('Approval not found');

            const app = approval[0];
            if (app.buyer_approved && app.seller_approved) {
                const { data: updated, error: updateError } = await this.supabase
                    .from('transaction_approvals')
                    .update({
                        transaction_completed: true,
                        transaction_completed_at: new Date().toISOString()
                    })
                    .eq('id', approvalId)
                    .select();

                if (updateError) throw updateError;
                return updated && updated.length > 0 ? updated[0] : null;
            }

            return app;
        } catch (error) {
            logger.error('Transaction completion error', error);
            throw error;
        }
    }

    /**
     * Onaylanmamış işlemleri getir (mesajlaşma panelinde göstermek için)
     */
    async getPendingApprovals(userId) {
        try {
            const { data: approvals, error } = await this.supabase
                .from('transaction_approvals')
                .select(`
                    *,
                    listings(id, title, image_url),
                    buyer:buyer_id(full_name),
                    seller:seller_id(full_name)
                `)
                .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
                .eq('transaction_completed', false)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return approvals || [];
        } catch (error) {
            logger.error('Pending approvals fetch error', error);
            return [];
        }
    }
}

export default TransactionApprovalManager;
