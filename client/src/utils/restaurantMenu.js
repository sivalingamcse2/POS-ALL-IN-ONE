export function getAssignedRestaurantIds(item) {
  const assignedIds = Array.isArray(item.restaurant_ids)
    ? item.restaurant_ids
    : [item.restaurant_id || 1];
  return [...new Set(assignedIds.filter(id => id !== null && id !== undefined).map(String))];
}

export function isAssignedToRestaurant(item, restaurantId) {
  return getAssignedRestaurantIds(item).includes(String(restaurantId || 1));
}

export function getRestaurantMenuCategories(categories, items, restaurantId) {
  const itemCategoryIds = new Set(
    items
      .filter(item => isAssignedToRestaurant(item, restaurantId))
      .map(item => String(item.category_id))
  );
  return categories.filter(category => (
    String(category.restaurant_id || 1) === String(restaurantId || 1)
    || itemCategoryIds.has(String(category.id))
  ));
}
