-- Alıcı-Satıcı İşlem Onay Sistemi
-- Bu tablo, alıcı ve satıcı arasında yapılan işlemlerin onaylanmasını yönetir

-- İşlem Onay Tablosu
CREATE TABLE IF NOT EXISTS transaction_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id BIGINT, -- İlgili mesajlaşma konuşması
    
    -- Onay durumları
    buyer_approved BOOLEAN DEFAULT false,
    seller_approved BOOLEAN DEFAULT false,
    buyer_approved_at TIMESTAMP WITH TIME ZONE,
    seller_approved_at TIMESTAMP WITH TIME ZONE,
    
    -- İşlem tamamlanma
    transaction_completed BOOLEAN DEFAULT false,
    transaction_completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Değerlendirme durumları
    buyer_rated BOOLEAN DEFAULT false,
    seller_rated BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(listing_id, buyer_id, seller_id)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_transaction_approvals_buyer ON transaction_approvals(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transaction_approvals_seller ON transaction_approvals(seller_id);
CREATE INDEX IF NOT EXISTS idx_transaction_approvals_listing ON transaction_approvals(listing_id);
CREATE INDEX IF NOT EXISTS idx_transaction_approvals_status ON transaction_approvals(transaction_completed, buyer_approved, seller_approved);
CREATE INDEX IF NOT EXISTS idx_transaction_approvals_conversation ON transaction_approvals(conversation_id);

-- RLS Politikaları
ALTER TABLE transaction_approvals ENABLE ROW LEVEL SECURITY;

-- Alıcı ve satıcı işlem onaylarını görebilir
DROP POLICY IF EXISTS "Users can view transaction approvals" ON transaction_approvals;
CREATE POLICY "Users can view transaction approvals"
    ON transaction_approvals FOR SELECT
    USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Alıcı kendi onayını güncelleyebilir
DROP POLICY IF EXISTS "Buyers can update own approval" ON transaction_approvals;
CREATE POLICY "Buyers can update own approval"
    ON transaction_approvals FOR UPDATE
    USING (auth.uid() = buyer_id)
    WITH CHECK (auth.uid() = buyer_id);

-- Satıcı kendi onayını güncelleyebilir
DROP POLICY IF EXISTS "Sellers can update own approval" ON transaction_approvals;
CREATE POLICY "Sellers can update own approval"
    ON transaction_approvals FOR UPDATE
    USING (auth.uid() = seller_id)
    WITH CHECK (auth.uid() = seller_id);

-- Alıcı işlem onayı oluşturabilir
DROP POLICY IF EXISTS "Users can insert transaction approvals" ON transaction_approvals;
CREATE POLICY "Users can insert transaction approvals"
    ON transaction_approvals FOR INSERT
    WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Trigger: Updated_at'ı otomatik güncelle
CREATE OR REPLACE FUNCTION update_transaction_approval_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transaction_approvals_update_timestamp ON transaction_approvals;
CREATE TRIGGER transaction_approvals_update_timestamp
    BEFORE UPDATE ON transaction_approvals
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_approval_timestamp();

-- Trigger: Her iki taraf da onayladığında transaction_completed'ı true yap
CREATE OR REPLACE FUNCTION auto_complete_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.buyer_approved = true AND NEW.seller_approved = true AND NEW.transaction_completed = false THEN
        NEW.transaction_completed = true;
        NEW.transaction_completed_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transaction_auto_complete ON transaction_approvals;
CREATE TRIGGER transaction_auto_complete
    BEFORE UPDATE ON transaction_approvals
    FOR EACH ROW
    EXECUTE FUNCTION auto_complete_transaction();
