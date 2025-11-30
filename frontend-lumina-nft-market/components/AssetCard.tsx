import React from 'react';
import { NFTMetadata } from '../types';
import { Clock, Tag, User, ShieldCheck } from 'lucide-react';

interface AssetCardProps {
  tokenId: string;
  metadata?: NFTMetadata;
  price?: string; // Display price or highest bid
  priceLabel?: string;
  owner?: string;
  children?: React.ReactNode;
  badge?: string;
  endTime?: number;
}

export const AssetCard: React.FC<AssetCardProps> = ({ 
  tokenId, 
  metadata, 
  price, 
  priceLabel,
  owner,
  children,
  badge,
  endTime
}) => {
  const timeLeft = endTime ? Math.max(0, endTime * 1000 - Date.now()) : 0;
  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col h-full group">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <img 
          src={metadata?.image || `https://picsum.photos/seed/${tokenId}/400/400`} 
          alt={metadata?.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-semibold text-slate-800 shadow-sm">
          #{tokenId}
        </div>
        {badge && (
          <div className="absolute top-3 left-3 bg-primary-600/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-white shadow-sm">
            {badge}
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="mb-3">
          <h3 className="text-lg font-bold text-slate-900 truncate">
            {metadata?.name || `Victoria Asset #${tokenId}`}
          </h3>
          <p className="text-sm text-slate-500 line-clamp-2 min-h-[2.5em]">
            {metadata?.description || "No description provided for this digital asset."}
          </p>
        </div>

        {owner && (
           <div className="flex items-center space-x-2 text-xs text-slate-400 mb-4">
              <User size={14} />
              <span className="truncate max-w-[150px]">{owner}</span>
           </div>
        )}

        <div className="mt-auto space-y-3">
          {price && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center space-x-2 text-slate-500 text-xs font-medium">
                {priceLabel === 'Highest Bid' ? <ShieldCheck size={14} /> : <Tag size={14} />}
                <span>{priceLabel || 'Price'}</span>
              </div>
              <div className="text-primary-600 font-bold font-mono">
                {price} cHKD
              </div>
            </div>
          )}

          {endTime !== undefined && (
            <div className="flex items-center justify-between px-1 text-xs text-slate-500">
                <div className="flex items-center space-x-1">
                    <Clock size={14} />
                    <span>Ends in:</span>
                </div>
                <span className={`font-mono font-medium ${timeLeft > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {timeLeft > 0 ? `${days}d ${hours}h ${minutes}m` : 'Ended'}
                </span>
            </div>
          )}

          <div className="pt-2 grid gap-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
