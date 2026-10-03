-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 026
-- PUBLIC ORDER TRACKING RPC (SECURITY DEFINER)
-- =============================================================================
-- Purpose:
-- Allows customers and guests to track order status by Order Number (KS#####)
-- or Order UUID without exposing orders table to arbitrary public queries.
-- Returns only non-sensitive milestone and fulfilment details.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.kotson_get_public_order_tracking(p_order_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_ident TEXT := TRIM(COALESCE(p_order_identifier, ''));
    v_order RECORD;
    v_items_list JSONB := '[]'::JSONB;
    v_shipments_list JSONB := '[]'::JSONB;
    v_item JSONB;
BEGIN
    IF v_clean_ident = '' THEN
        RETURN jsonb_build_object('found', false, 'error', 'Order number or ID is required');
    END IF;

    -- Match by order_number (case-insensitive) or by id (UUID) or by razorpay_order_id
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE UPPER(order_number) = UPPER(v_clean_ident)
       OR (v_clean_ident ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = v_clean_ident::UUID)
       OR UPPER(razorpay_order_id) = UPPER(v_clean_ident)
    ORDER BY created_at DESC 
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('found', false, 'error', 'No order found matching that order number or ID.');
    END IF;

    -- Format items
    IF v_order.items IS NOT NULL AND jsonb_array_length(v_order.items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
        LOOP
            v_items_list := v_items_list || jsonb_build_object(
                'product_name', COALESCE(v_item->>'product_name', v_item->>'title', v_item->>'name', 'Kotson Mattress / Accessory'),
                'qty', GREATEST(1, COALESCE((v_item->>'qty')::INT, (v_item->>'quantity')::INT, 1))
            );
        END LOOP;
    END IF;

    -- Format shipments
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'shipment_number', s.shipment_number,
                'status', s.status,
                'carrier', s.carrier,
                'tracking_reference', COALESCE(s.tracking_reference, s.awb_number),
                'tracking_url', s.tracking_url,
                'tracking_is_manual', true,
                'items', COALESCE(s.items, '[]'::JSONB),
                'milestones', COALESCE(s.events, '[]'::JSONB)
            )
        ), '[]'::JSONB
    ) INTO v_shipments_list
    FROM public.shipments s
    WHERE s.order_id = v_order.id OR UPPER(s.order_number) = UPPER(v_order.order_number);

    RETURN jsonb_build_object(
        'found', true,
        'order_number', v_order.order_number,
        'payment_status', COALESCE(v_order.payment_status, 'pending'),
        'fulfilment_status', COALESCE(v_order.fulfilment_status, 'processing'),
        'placed_at', v_order.created_at,
        'items', v_items_list,
        'shipments', v_shipments_list,
        'tracking_note', 'Shipment updates are entered by Kotson logistics staff as your order progresses.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.kotson_get_public_order_tracking(TEXT) TO anon, authenticated, service_role;
