import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { updateUser } from '../store/slices/userSlice.js'
import api from '../services/api.js'

// Товары магазина согласно ТЗ
const SHOP_ITEMS = {
  skins: [
    { id: 'skin_pirate', name: 'Пиратский флот', description: 'Тёмные корабли с черепами', price: 500, currency: 'gold', preview: '🏴‍☠️' },
    { id: 'skin_military', name: 'Военный флот', description: 'Камуфляжные корабли', price: 750, currency: 'gold', preview: '🎖️' },
    { id: 'skin_neon', name: 'Неоновый флот', description: 'Светящиеся в темноте', price: 1000, currency: 'gold', preview: '✨' },
    { id: 'skin_golden', name: 'Золотой флот', description: 'Роскошные золотые корабли', price: 50, currency: 'gems', preview: '👑' },
    { id: 'skin_space', name: 'Космический флот', description: 'Корабли будущего', price: 100, currency: 'gems', preview: '🚀' },
  ],
  boards: [
    { id: 'board_ocean', name: 'Океан', description: 'Классическая морская тема', price: 0, currency: 'gold', preview: '🌊', isDefault: true },
    { id: 'board_arctic', name: 'Арктика', description: 'Ледяные воды', price: 300, currency: 'gold', preview: '❄️' },
    { id: 'board_tropical', name: 'Тропики', description: 'Бирюзовые воды', price: 400, currency: 'gold', preview: '🏝️' },
    { id: 'board_night', name: 'Ночное море', description: 'Тёмная тема', price: 500, currency: 'gold', preview: '🌙' },
  ],
  bundles: [
    { id: 'gems_100', name: '100 Гемов', description: 'Немного гемов', price: 99, currency: 'rub', gems: 100, preview: '💎' },
    { id: 'gems_500', name: '500 Гемов', description: '+50 бонусных', price: 449, currency: 'rub', gems: 550, preview: '💎💎' },
    { id: 'gems_1000', name: '1000 Гемов', description: '+200 бонусных', price: 799, currency: 'rub', gems: 1200, preview: '💎💎💎' },
    { id: 'starter_pack', name: 'Стартовый набор', description: '500 Gold + 50 Gems + Скин', price: 149, currency: 'rub', preview: '🎁' },
  ],
}

function Shop() {
  const dispatch = useDispatch()
  const user = useSelector((state) => state.user.user)
  const [activeTab, setActiveTab] = useState('skins')
  const [purchasing, setPurchasing] = useState(null)
  const [message, setMessage] = useState(null)

  // Купленные предметы (в реальности будут храниться на сервере)
  const [ownedItems, setOwnedItems] = useState(new Set(['board_ocean']))

  const handlePurchase = async (item) => {
    if (ownedItems.has(item.id)) {
      setMessage({ type: 'info', text: 'У вас уже есть этот предмет!' })
      return
    }

    if (item.currency === 'rub') {
      // Реальная покупка - интеграция с Telegram Payments
      setMessage({ type: 'info', text: 'Оплата через Telegram скоро будет доступна' })
      return
    }

    const userCurrency = item.currency === 'gold' ? user?.gold : user?.gems
    if ((userCurrency || 0) < item.price) {
      setMessage({ type: 'error', text: `Недостаточно ${item.currency === 'gold' ? 'золота' : 'гемов'}!` })
      return
    }

    setPurchasing(item.id)
    
    try {
      // Имитация покупки (в реальности - запрос к API)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setOwnedItems(prev => new Set([...prev, item.id]))
      
      // Обновляем валюту пользователя
      if (item.currency === 'gold') {
        dispatch(updateUser({ gold: (user?.gold || 0) - item.price }))
      } else if (item.currency === 'gems') {
        dispatch(updateUser({ gems: (user?.gems || 0) - item.price }))
      }
      
      setMessage({ type: 'success', text: `${item.name} куплен!` })
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка покупки' })
    } finally {
      setPurchasing(null)
    }
  }

  const formatPrice = (item) => {
    if (item.currency === 'gold') return `${item.price} 🪙`
    if (item.currency === 'gems') return `${item.price} 💎`
    if (item.currency === 'rub') return `${item.price} ₽`
    return item.price
  }

  const tabs = [
    { id: 'skins', name: '🚢 Скины', items: SHOP_ITEMS.skins },
    { id: 'boards', name: '🎨 Доски', items: SHOP_ITEMS.boards },
    { id: 'bundles', name: '💎 Гемы', items: SHOP_ITEMS.bundles },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Заголовок и баланс */}
        <div className="bg-white rounded-lg shadow-lg p-4">
          <h2 className="text-2xl font-bold text-center mb-4">🛍️ Магазин</h2>
          
          {/* Баланс пользователя */}
          <div className="flex justify-center gap-6">
            <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-lg">
              <span className="text-xl">🪙</span>
              <span className="font-bold text-yellow-600">{user?.gold || 0}</span>
            </div>
            <div className="flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-lg">
              <span className="text-xl">💎</span>
              <span className="font-bold text-purple-600">{user?.gems || 0}</span>
            </div>
          </div>
        </div>

        {/* Сообщение */}
        {message && (
          <div className={`p-3 rounded-lg text-center ${
            message.type === 'success' ? 'bg-green-100 text-green-700' :
            message.type === 'error' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Табы */}
        <div className="flex bg-white rounded-lg shadow overflow-hidden">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                activeTab === tab.id 
                  ? 'bg-primary text-white' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Товары */}
        <div className="space-y-3">
          {tabs.find(t => t.id === activeTab)?.items.map(item => {
            const isOwned = ownedItems.has(item.id)
            const isPurchasing = purchasing === item.id
            
            return (
              <div 
                key={item.id}
                className={`bg-white rounded-lg shadow p-4 flex items-center gap-4 ${
                  isOwned ? 'border-2 border-green-400' : ''
                }`}
              >
                <div className="text-4xl">{item.preview}</div>
                <div className="flex-1">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-600">{item.description}</p>
                  {item.gems && (
                    <p className="text-xs text-purple-600 font-semibold">
                      Получите {item.gems} гемов
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {isOwned ? (
                    <span className="text-green-600 font-semibold">✓ Куплено</span>
                  ) : item.price === 0 ? (
                    <span className="text-gray-500">Бесплатно</span>
                  ) : (
                    <button
                      onClick={() => handlePurchase(item)}
                      disabled={isPurchasing}
                      className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                        item.currency === 'rub'
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : 'bg-primary text-white hover:bg-blue-600'
                      } disabled:opacity-50`}
                    >
                      {isPurchasing ? '...' : formatPrice(item)}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Специальное предложение */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg p-4 text-white">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🎉</span>
            <div className="flex-1">
              <p className="font-bold">Специальное предложение!</p>
              <p className="text-sm opacity-90">Удвоенные гемы на первую покупку</p>
            </div>
          </div>
        </div>

        <Link
          to="/"
          className="block text-center text-primary hover:underline py-4"
        >
          ← Назад в меню
        </Link>
      </div>
    </div>
  )
}

export default Shop
