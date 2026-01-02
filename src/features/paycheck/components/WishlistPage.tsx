import { useEffect, useMemo, useState } from 'react';
import {
  Heart,
  Star,
  Plus,
  Check,
  Trash2,
  Edit2,
  ShoppingBag,
  AlertCircle,
  Clock,
  PiggyBank,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import {
  fetchWishlistItems,
  createWishlistItem,
  updateWishlistItem,
  deleteWishlistItem,
  markWishlistItemPurchased,
} from '../wishlistSlice';
import { fetchBuffer } from '../bufferSlice';
import { fetchBills } from '../billsSlice';
import { fetchActiveCycle } from '../paycheckCyclesSlice';
import { AppLayout } from '../../../components/layout';
import {
  Card,
  CardHeader,
  Button,
  Modal,
  Input,
  Select,
  CurrencyInput,
  Badge,
} from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import {
  WishlistItem,
  WishlistItemType,
  WishlistPriority,
  WishlistRecommendation,
} from '../../../types';

const TYPE_OPTIONS = [
  { value: 'need', label: 'Need' },
  { value: 'want', label: 'Want' },
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

interface ItemFormData {
  name: string;
  price: number;
  type: WishlistItemType;
  priority: WishlistPriority;
  notes: string;
}

const initialFormData: ItemFormData = {
  name: '',
  price: 0,
  type: 'want',
  priority: 'medium',
  notes: '',
};

// Recommendation badge config
const recommendationConfig: Record<
  WishlistRecommendation,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'info'; icon: typeof ThumbsUp }
> = {
  safe: { label: 'Safe to buy', variant: 'success', icon: ThumbsUp },
  wait: { label: 'Wait', variant: 'warning', icon: Clock },
  save: { label: 'Save up', variant: 'info', icon: PiggyBank },
  'not-recommended': { label: 'Not recommended', variant: 'danger', icon: AlertCircle },
};

export const WishlistPage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId, allIds, isLoading } = useAppSelector((state) => state.wishlist);
  const { buffer } = useAppSelector((state) => state.buffer);
  const { byId: billsById, allIds: billIds } = useAppSelector((state) => state.bills);
  const { byId: cyclesById, activeCycleId } = useAppSelector((state) => state.paycheckCycles);
  const activeCycle = activeCycleId ? cyclesById[activeCycleId] : null;

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [formData, setFormData] = useState<ItemFormData>(initialFormData);

  // Filter state
  const [showPurchased, setShowPurchased] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    if (user) {
      dispatch(fetchWishlistItems(user.uid));
      dispatch(fetchBuffer(user.uid));
      dispatch(fetchBills(user.uid));
      dispatch(fetchActiveCycle(user.uid));
    }
  }, [dispatch, user]);

  // Get all items as array
  const allItems = useMemo(() => {
    return allIds.map((id) => byId[id]).filter(Boolean);
  }, [byId, allIds]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (showPurchased) {
      return allItems;
    }
    return allItems.filter((item) => !item.isPurchased);
  }, [allItems, showPurchased]);

  // Calculate upcoming bills total
  const upcomingBillsTotal = useMemo(() => {
    const activeBills = billIds
      .map((id) => billsById[id])
      .filter((bill) => bill && bill.isActive);

    // Simple calculation: sum of monthly equivalent bills
    return activeBills.reduce((total, bill) => {
      let monthlyAmount = bill.amount;
      switch (bill.frequency) {
        case 'bi-weekly':
          monthlyAmount = bill.amount * 2.17; // ~2.17 bi-weekly periods per month
          break;
        case 'quarterly':
          monthlyAmount = bill.amount / 3;
          break;
        case 'semi-annual':
          monthlyAmount = bill.amount / 6;
          break;
        case 'annual':
          monthlyAmount = bill.amount / 12;
          break;
        case 'one-time':
          monthlyAmount = 0; // Don't count one-time in regular calculation
          break;
      }
      return total + monthlyAmount;
    }, 0);
  }, [billsById, billIds]);

  // Calculate available funds and emergency floor
  const financialStatus = useMemo(() => {
    const bufferAmount = buffer?.totalAmount || 0;
    const cycleRemaining = activeCycle?.remainingToSpend || 0;

    // Emergency floor: 50% of buffer or $500, whichever is higher
    const emergencyFloor = Math.max(bufferAmount * 0.5, 500);

    // Safe to spend from buffer
    const safeBufferAmount = Math.max(0, bufferAmount - emergencyFloor);

    // Total available = cycle remaining + safe buffer
    const totalAvailable = cycleRemaining + safeBufferAmount;

    // Average cycle length (assume ~14 days for bi-weekly, ~15 for semi-monthly)
    const avgCycleLength = 14;
    const estimatedCyclesPerMonth = 30 / avgCycleLength;

    return {
      bufferAmount,
      cycleRemaining,
      emergencyFloor,
      safeBufferAmount,
      totalAvailable,
      estimatedCyclesPerMonth,
    };
  }, [buffer, activeCycle]);

  // Calculate recommendation for an item
  const getRecommendation = (item: WishlistItem): { recommendation: WishlistRecommendation; reason: string; saveCycles?: number } => {
    if (item.isPurchased) {
      return { recommendation: 'safe', reason: 'Already purchased' };
    }

    const { totalAvailable, safeBufferAmount, cycleRemaining, emergencyFloor, bufferAmount } = financialStatus;
    const price = item.price;

    // High-priority needs get more lenient treatment
    const isUrgentNeed = item.type === 'need' && item.priority === 'high';

    // Check if it fits in current cycle spending
    if (price <= cycleRemaining) {
      return {
        recommendation: 'safe',
        reason: `Fits within your remaining ${formatCurrency(cycleRemaining)} for this cycle`,
      };
    }

    // Check if it fits with safe buffer usage
    if (price <= totalAvailable) {
      if (isUrgentNeed) {
        return {
          recommendation: 'safe',
          reason: `Urgent need - can use buffer (${formatCurrency(safeBufferAmount)} available above emergency floor)`,
        };
      }
      return {
        recommendation: 'wait',
        reason: `Would require using ${formatCurrency(price - cycleRemaining)} from buffer. Consider waiting for next cycle.`,
      };
    }

    // Would dip into emergency floor
    if (price <= cycleRemaining + bufferAmount) {
      if (isUrgentNeed) {
        return {
          recommendation: 'wait',
          reason: `Would reduce buffer below ${formatCurrency(emergencyFloor)} emergency floor. Wait if possible.`,
        };
      }
      return {
        recommendation: 'not-recommended',
        reason: `Would reduce buffer below ${formatCurrency(emergencyFloor)} emergency floor`,
      };
    }

    // Need to save up
    const avgCycleSavings = cycleRemaining > 0 ? cycleRemaining * 0.5 : 50; // Assume can save half of remaining, or $50
    const cyclesToSave = Math.ceil(price / avgCycleSavings);

    return {
      recommendation: 'save',
      reason: `Save ${formatCurrency(avgCycleSavings)}/cycle to afford in ~${cyclesToSave} cycles`,
      saveCycles: cyclesToSave,
    };
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name || formData.price <= 0) return;

    if (editingItem) {
      await dispatch(
        updateWishlistItem({
          userId: user.uid,
          itemId: editingItem.id,
          updates: formData,
        })
      );
    } else {
      await dispatch(
        createWishlistItem({
          userId: user.uid,
          item: formData,
        })
      );
    }

    setFormData(initialFormData);
    setEditingItem(null);
    setIsAddModalOpen(false);
  };

  // Handle edit
  const handleEdit = (item: WishlistItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: item.price,
      type: item.type,
      priority: item.priority,
      notes: item.notes,
    });
    setIsAddModalOpen(true);
  };

  // Handle delete
  const handleDelete = async (itemId: string) => {
    if (!user) return;
    await dispatch(deleteWishlistItem({ userId: user.uid, itemId }));
  };

  // Handle mark as purchased
  const handleMarkPurchased = async (itemId: string) => {
    if (!user) return;
    await dispatch(markWishlistItemPurchased({ userId: user.uid, itemId }));
  };

  // Close modal
  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingItem(null);
    setFormData(initialFormData);
  };

  // Stats
  const stats = useMemo(() => {
    const unpurchased = allItems.filter((item) => !item.isPurchased);
    const needs = unpurchased.filter((item) => item.type === 'need');
    const wants = unpurchased.filter((item) => item.type === 'want');
    const totalNeeded = needs.reduce((sum, item) => sum + item.price, 0);
    const totalWanted = wants.reduce((sum, item) => sum + item.price, 0);

    return {
      needsCount: needs.length,
      wantsCount: wants.length,
      totalNeeded,
      totalWanted,
      total: totalNeeded + totalWanted,
    };
  }, [allItems]);

  return (
    <AppLayout title="Wishlist">
      <div className="space-y-4 md:space-y-6">
        {/* Financial Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card padding="sm">
            <p className="text-xs md:text-sm text-gray-500">Available Now</p>
            <p className="text-lg md:text-2xl font-bold text-green-600">
              {formatCurrency(financialStatus.cycleRemaining)}
            </p>
            <p className="text-xs text-gray-400">This cycle</p>
          </Card>
          <Card padding="sm">
            <p className="text-xs md:text-sm text-gray-500">Buffer</p>
            <p className="text-lg md:text-2xl font-bold text-blue-600">
              {formatCurrency(financialStatus.bufferAmount)}
            </p>
            <p className="text-xs text-gray-400">
              {formatCurrency(financialStatus.safeBufferAmount)} above floor
            </p>
          </Card>
          <Card padding="sm">
            <p className="text-xs md:text-sm text-gray-500">Needs</p>
            <p className="text-lg md:text-2xl font-bold text-orange-600">
              {formatCurrency(stats.totalNeeded)}
            </p>
            <p className="text-xs text-gray-400">{stats.needsCount} items</p>
          </Card>
          <Card padding="sm">
            <p className="text-xs md:text-sm text-gray-500">Wants</p>
            <p className="text-lg md:text-2xl font-bold text-purple-600">
              {formatCurrency(stats.totalWanted)}
            </p>
            <p className="text-xs text-gray-400">{stats.wantsCount} items</p>
          </Card>
        </div>

        {/* Wishlist Items */}
        <Card>
          <CardHeader
            title="Your Wishlist"
            subtitle={`${filteredItems.length} items`}
            action={
              <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            }
          />

          {/* Filter toggle */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showPurchased}
                onChange={(e) => setShowPurchased(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Show purchased items
            </label>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No items in your wishlist</p>
              <p className="text-sm mt-1">Add items you want or need to track</p>
              <Button className="mt-4" onClick={() => setIsAddModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Add First Item
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const { recommendation, reason, saveCycles } = getRecommendation(item);
                const config = recommendationConfig[recommendation];
                const isExpanded = expandedItemId === item.id;
                const RecommendationIcon = config.icon;

                return (
                  <div
                    key={item.id}
                    className={clsx(
                      'border rounded-lg transition-all',
                      item.isPurchased
                        ? 'bg-gray-50 border-gray-200 opacity-60'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {/* Main row */}
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer"
                      onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                    >
                      {/* Type indicator */}
                      <div
                        className={clsx(
                          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                          item.type === 'need' ? 'bg-orange-100' : 'bg-purple-100'
                        )}
                      >
                        {item.type === 'need' ? (
                          <Star className="w-5 h-5 text-orange-600" />
                        ) : (
                          <Heart className="w-5 h-5 text-purple-600" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={clsx(
                              'font-medium truncate',
                              item.isPurchased ? 'text-gray-500 line-through' : 'text-gray-900'
                            )}
                          >
                            {item.name}
                          </p>
                          <Badge
                            variant={
                              item.priority === 'high'
                                ? 'danger'
                                : item.priority === 'medium'
                                  ? 'warning'
                                  : 'default'
                            }
                          >
                            {item.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm font-semibold text-gray-700">
                            {formatCurrency(item.price)}
                          </span>
                          {!item.isPurchased && (
                            <Badge variant={config.variant}>
                              <RecommendationIcon className="w-3 h-3 mr-1" />
                              {config.label}
                            </Badge>
                          )}
                          {item.isPurchased && (
                            <Badge variant="success">
                              <Check className="w-3 h-3 mr-1" />
                              Purchased
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Expand indicator */}
                      <div className="text-gray-400">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-gray-100 pt-3">
                        {/* Recommendation reason */}
                        {!item.isPurchased && (
                          <div
                            className={clsx('p-3 rounded-lg mb-3 text-sm', {
                              'bg-green-50 text-green-700': recommendation === 'safe',
                              'bg-yellow-50 text-yellow-700': recommendation === 'wait',
                              'bg-blue-50 text-blue-700': recommendation === 'save',
                              'bg-red-50 text-red-700': recommendation === 'not-recommended',
                            })}
                          >
                            <div className="flex items-start gap-2">
                              <RecommendationIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium">{config.label}</p>
                                <p className="mt-0.5">{reason}</p>
                                {saveCycles && (
                                  <p className="mt-1 font-medium">
                                    Target: ~{saveCycles} pay cycles
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {item.notes && (
                          <p className="text-sm text-gray-600 mb-3">
                            <span className="font-medium">Notes:</span> {item.notes}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {!item.isPurchased && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkPurchased(item.id);
                              }}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Mark Purchased
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(item);
                            }}
                          >
                            <Edit2 className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Delete this item?')) {
                                handleDelete(item.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Add/Edit Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={handleCloseModal}
          title={editingItem ? 'Edit Item' : 'Add to Wishlist'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Item Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., New laptop, Winter jacket"
              required
            />

            <CurrencyInput
              label="Price"
              value={formData.price}
              onChange={(value) => setFormData({ ...formData, price: value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as WishlistItemType })
                }
                options={TYPE_OPTIONS}
              />

              <Select
                label="Priority"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value as WishlistPriority })
                }
                options={PRIORITY_OPTIONS}
              />
            </div>

            <Input
              label="Notes (optional)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional details..."
            />

            {/* Preview recommendation */}
            {formData.name && formData.price > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-1">Preview:</p>
                {(() => {
                  const previewItem = {
                    ...formData,
                    id: 'preview',
                    isPurchased: false,
                  } as WishlistItem;
                  const { recommendation, reason } = getRecommendation(previewItem);
                  const config = recommendationConfig[recommendation];
                  const Icon = config.icon;
                  return (
                    <div className="flex items-center gap-2">
                      <Badge variant={config.variant}>
                        <Icon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                      <span className="text-xs text-gray-500">{reason}</span>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={!formData.name || formData.price <= 0}
              >
                {editingItem ? 'Save Changes' : 'Add Item'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
};
