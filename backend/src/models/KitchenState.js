import mongoose from 'mongoose';

const defaultSustainability = {
  itemsConsumedBeforeExpiry: 0,
  dealsClaimed: 0,
  kgFoodWasteAvoided: 0,
  co2KgSaved: 0,
  plasticItemsAvoided: 0,
  recipesCooked: 0,
};

/**
 * Per-user kitchen document (keyed by userId). Legacy docs used key: 'default' only.
 */
const kitchenStateSchema = new mongoose.Schema(
  {
    userId: { type: String, trim: true, maxlength: 120, default: 'default' },
    key: { type: String, default: 'default' },
    pantryItems: { type: mongoose.Schema.Types.Mixed, default: [] },
    shoppingList: { type: mongoose.Schema.Types.Mixed, default: [] },
    notifications: { type: Number, default: 0 },
    userName: { type: String, default: 'User' },
    userInitials: { type: String, default: 'U' },
    notifData: { type: mongoose.Schema.Types.Mixed, default: [] },
    sustainability: { type: mongoose.Schema.Types.Mixed, default: () => ({ ...defaultSustainability }) },
    /** { dealId: string, claimedAt: ISO string }[] */
    claimedDeals: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);

kitchenStateSchema.index({ userId: 1 }, { unique: true });
kitchenStateSchema.index({ key: 1 });

export const KitchenState = mongoose.model('KitchenState', kitchenStateSchema);
export { defaultSustainability };
