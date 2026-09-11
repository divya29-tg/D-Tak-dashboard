import { useState, useEffect } from 'react';
import { X, Search, MapPin, Layers } from 'lucide-react';
import './OverlayManager.css';

export interface OverlayItem {
  id: string;
  name: string;
  category: string;
  type: 'pin' | 'layer' | 'alert' | 'route';
  metadata: string;
  enabled: boolean;
}

interface OverlayManagerProps {
  isOpen: boolean;
  onClose: () => void;
  isGlobalEnabled: boolean;
  onToggleGlobal: (enabled: boolean) => void;
  overlays: OverlayItem[];
  onToggleOverlay: (id: string, enabled: boolean) => void;
}

export function OverlayManager({
  isOpen,
  onClose,
  isGlobalEnabled,
  onToggleGlobal,
  overlays,
  onToggleOverlay,
}: OverlayManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredOverlays = overlays.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.metadata.toLowerCase().includes(q)
    );
  });

  // Group overlays by category
  const categories = Array.from(new Set(filteredOverlays.map((item) => item.category)));

  return (
    <div className="overlay-manager-backdrop" onClick={onClose} role="presentation">
      <div
        className="overlay-manager-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="overlay-manager-title"
      >
        {/* Header */}
        <div className="overlay-manager-header">
          <div className="overlay-manager-header-left">
            <h2 id="overlay-manager-title" className="overlay-manager-title">
              Overlay Manager
            </h2>
            <button
              type="button"
              className={`overlay-toggle-pill ${isGlobalEnabled ? 'overlay-toggle-pill--active' : ''}`}
              onClick={() => onToggleGlobal(!isGlobalEnabled)}
              title={isGlobalEnabled ? 'Disable All Map Overlays' : 'Enable All Map Overlays'}
              aria-label="Master Overlay Switch"
            >
              <span className="overlay-toggle-thumb" />
            </button>
          </div>

          <button
            type="button"
            className="overlay-manager-close-btn"
            onClick={onClose}
            aria-label="Close Overlay Manager"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Field */}
        <div className="overlay-search-container">
          <Search size={18} className="overlay-search-icon" />
          <input
            type="text"
            className="overlay-search-input"
            placeholder="Search pins, CASEVAC, alerts, routes...."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Overlay Categories & Items */}
        <div className="overlay-manager-content">
          {filteredOverlays.length === 0 ? (
            <div className="overlay-empty-state">
              <Layers size={28} className="overlay-empty-icon" />
              <p className="overlay-empty-text">No active overlays found</p>
              <span className="overlay-empty-subtext">
                {searchQuery
                  ? 'No overlays match your search criteria.'
                  : 'Acquire your current location or enable map layers to register overlays.'}
              </span>
            </div>
          ) : (
            categories.map((category) => {
              const categoryItems = filteredOverlays.filter((item) => item.category === category);
              return (
                <div key={category} className="overlay-category-group">
                  <h3 className="overlay-category-title">
                    {category} ({categoryItems.length})
                  </h3>
                  <div className="overlay-category-list">
                    {categoryItems.map((item) => {
                      const isItemActive = isGlobalEnabled && item.enabled;
                      return (
                        <div key={item.id} className="overlay-row">
                          <div className="overlay-row-left">
                            <div className="overlay-icon-container">
                              {item.type === 'layer' ? (
                                <Layers size={18} className="overlay-pin-icon" />
                              ) : (
                                <MapPin size={20} className="overlay-pin-icon" />
                              )}
                            </div>
                            <div className="overlay-row-text">
                              <span className="overlay-row-name">{item.name}</span>
                              <span className="overlay-row-metadata">{item.metadata}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            className={`overlay-toggle-pill ${isItemActive ? 'overlay-toggle-pill--active' : ''}`}
                            onClick={() => onToggleOverlay(item.id, !item.enabled)}
                            title={isItemActive ? `Disable ${item.name}` : `Enable ${item.name}`}
                          >
                            <span className="overlay-toggle-thumb" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
