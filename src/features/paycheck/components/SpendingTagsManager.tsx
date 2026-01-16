import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Tag, AlertTriangle, Sparkles } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import {
  createSpendingTag,
  updateSpendingTag,
  deleteSpendingTag,
  createDefaultSpendingTags,
} from '../spendingTagsSlice';
import { Card, CardHeader, Button, Input, Modal } from '../../../components/shared';
import { SpendingTag } from '../../../types';

export const SpendingTagsManager = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId, allIds } = useAppSelector((state) => state.spendingTags);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<SpendingTag | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<SpendingTag | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const spendingTags = useMemo(() => {
    return allIds.map((id) => byId[id]).filter(Boolean);
  }, [allIds, byId]);

  const defaultTags = useMemo(() => spendingTags.filter((t) => !t.isCustom), [spendingTags]);
  const customTags = useMemo(() => spendingTags.filter((t) => t.isCustom), [spendingTags]);

  const handleAdd = () => {
    setEditingTag(null);
    setFormName('');
    setModalOpen(true);
  };

  const handleEdit = (tag: SpendingTag) => {
    setEditingTag(tag);
    setFormName(tag.name);
    setModalOpen(true);
  };

  const handleDeleteClick = (tag: SpendingTag) => {
    setTagToDelete(tag);
    setDeleteConfirmOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formName.trim()) return;

    setIsSaving(true);
    try {
      if (editingTag) {
        await dispatch(
          updateSpendingTag({
            userId: user.uid,
            tagId: editingTag.id,
            updates: {
              name: formName.trim().toLowerCase(),
            },
          })
        ).unwrap();
      } else {
        await dispatch(
          createSpendingTag({
            userId: user.uid,
            tag: {
              name: formName.trim().toLowerCase(),
              isCustom: true,
              usageCount: 0,
            },
          })
        ).unwrap();
      }
      setModalOpen(false);
    } catch (error) {
      console.error('Failed to save spending tag:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !tagToDelete) return;

    setIsDeleting(true);
    try {
      await dispatch(
        deleteSpendingTag({
          userId: user.uid,
          tagId: tagToDelete.id,
        })
      ).unwrap();
      setDeleteConfirmOpen(false);
      setTagToDelete(null);
    } catch (error) {
      console.error('Failed to delete spending tag:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateDefaults = async () => {
    if (!user) return;
    await dispatch(createDefaultSpendingTags(user.uid));
  };

  const TagItem = ({ tag, showActions = true }: { tag: SpendingTag; showActions?: boolean }) => (
    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{tag.name}</span>
        {tag.usageCount > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">({tag.usageCount})</span>
        )}
      </div>
      {showActions && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleEdit(tag)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDeleteClick(tag)}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader
            title="Spending Tags"
            subtitle="Optional labels to categorize your spending"
          />
          <Button onClick={handleAdd} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Tag
          </Button>
        </div>

        {spendingTags.length === 0 ? (
          <div className="text-center py-8">
            <Tag className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">No spending tags yet.</p>
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={handleCreateDefaults}>
                <Sparkles className="w-4 h-4 mr-2" />
                Add Suggested Tags
              </Button>
              <Button onClick={handleAdd}>Create Custom</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Default Tags */}
            {defaultTags.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Suggested Tags
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {defaultTags.map((tag) => (
                    <TagItem key={tag.id} tag={tag} showActions={false} />
                  ))}
                </div>
              </div>
            )}

            {/* Custom Tags */}
            {customTags.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Your Tags
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {customTags.map((tag) => (
                    <TagItem key={tag.id} tag={tag} />
                  ))}
                </div>
              </div>
            )}

            {/* Add suggested if only custom exist */}
            {defaultTags.length === 0 && (
              <div className="pt-2">
                <Button variant="secondary" onClick={handleCreateDefaults} className="w-full">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Add Suggested Tags
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Tags are optional and help you see spending patterns. Common tags: groceries, gas, dining, entertainment.
        </p>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTag ? 'Edit Tag' : 'Add Tag'}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Tag Name"
            placeholder="e.g., groceries, gas, coffee"
            value={formName}
            onChange={(e) => setFormName(e.target.value.toLowerCase())}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Keep tag names short and simple for quick selection.
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={isSaving} disabled={!formName.trim()}>
              {editingTag ? 'Save' : 'Add Tag'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete Tag"
        size="sm"
      >
        <div className="space-y-4">
          {tagToDelete && (
            <>
              <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  Are you sure you want to delete the tag <strong>{tagToDelete.name}</strong>?
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmDelete}
                  isLoading={isDeleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
};
