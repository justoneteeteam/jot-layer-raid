CREATE UNIQUE INDEX IF NOT EXISTS `uniq_store_order_item` ON `orders` (`store_id`, `order_id`, `product_name`, `variant`);
