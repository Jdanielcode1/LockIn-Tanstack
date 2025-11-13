import { useState } from 'react'

interface DeleteConfirmationModalProps {
  title: string
  message: string
  onConfirm: () => Promise<void>
  onClose: () => void
  confirmButtonText?: string
  isDestructive?: boolean
}

export function DeleteConfirmationModal({
  title,
  message,
  onConfirm,
  onClose,
  confirmButtonText = 'Delete',
  isDestructive = true,
}: DeleteConfirmationModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Delete error:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>

        <p className="text-gray-300 mb-6">{message}</p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 bg-gray-700 border border-gray-600 text-gray-300 py-2.5 rounded-md hover:bg-gray-600 transition font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className={`flex-1 py-2.5 rounded-md transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${
              isDestructive
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isDeleting ? 'Deleting...' : confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  )
}
