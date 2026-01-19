import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { motion } from 'framer-motion'
import { haptic } from '../utils/telegram.js'
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
    { id: 'skins', name: '🚢 Скины', items: SHOP_ITEMS.skins, color: 'from-blue-500 to-purple-500' },
    { id: 'boards', name: '🎨 Доски', items: SHOP_ITEMS.boards, color: 'from-green-500 to-teal-500' },
    { id: 'bundles', name: '💎 Гемы', items: SHOP_ITEMS.bundles, color: 'from-purple-500 to-pink-500' },
  ]

  // Анимации
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    },
  }

  const floatingVariants = {
    animate: {
      y: [0, -10, 0],
      rotate: [0, 2, 0, -2, 0],
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Фоновые элементы */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-cyan-900/20" />
        <motion.div
          className="absolute top-20 left-10 w-2 h-2 bg-blue-400/30 rounded-full"
          animate={{
            y: [0, -100, 0],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity, delay: 0 }}
        />
        <motion.div
          className="absolute top-32 right-16 w-1 h-1 bg-purple-400/40 rounded-full"
          animate={{
            y: [0, -80, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{ duration: 3, repeat: Infinity, delay: 1 }}
        />
      </div>

      <motion.div
        className="max-w-md mx-auto pt-8 px-4 relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Заголовок */}
        <motion.div
          variants={itemVariants}
          className="text-center mb-8"
        >
          <motion.div
            variants={floatingVariants}
            animate="animate"
            className="inline-block"
          >
            <h1 className="text-5xl font-black text-transparent bg-gradient-to-r from-white via-green-100 to-blue-200 bg-clip-text drop-shadow-2xl">
              МАГАЗИН
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <motion.div
                className="w-8 h-1 bg-gradient-to-r from-green-400 to-blue-500 rounded-full"
                animate={{ scaleX: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
              <p className="text-white/80 font-medium tracking-widest text-sm uppercase">
                Покупки и улучшения
              </p>
              <motion.div
                className="w-8 h-1 bg-gradient-to-r from-blue-500 to-green-400 rounded-full"
                animate={{ scaleX: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Баланс пользователя */}
        <motion.div
          variants={itemVariants}
          className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl mb-6"
        >
          <h3 className="text-white font-bold text-center mb-4">Ваш баланс</h3>
          <div className="flex justify-center gap-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 px-6 py-3 rounded-xl text-white shadow-lg flex items-center gap-3"
            >
              <span className="text-2xl">🪙</span>
              <div className="text-center">
                <div className="text-2xl font-black">{user?.gold || 0}</div>
                <div className="text-xs opacity-80">Золото</div>
              </div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 rounded-xl text-white shadow-lg flex items-center gap-3"
            >
              <span className="text-2xl">💎</span>
              <div className="text-center">
                <div className="text-2xl font-black">{user?.gems || 0}</div>
                <div className="text-xs opacity-80">Гемы</div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Сообщение */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl text-center backdrop-blur-xl border shadow-2xl ${
              message.type === 'success'
                ? 'bg-green-500/20 border-green-400/50 text-green-100'
                : message.type === 'error'
                ? 'bg-red-500/20 border-red-400/50 text-red-100'
                : 'bg-blue-500/20 border-blue-400/50 text-blue-100'
            }`}
          >
            {message.text}
          </motion.div>
        )}

        {/* Табы */}
        <motion.div
          variants={itemVariants}
          className="flex bg-white/10 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/20 shadow-2xl mb-6"
        >
          {tabs.map(tab => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex-1 py-4 text-sm font-bold transition-all relative overflow-hidden ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  className={`absolute inset-0 bg-gradient-to-r ${tab.color}`}
                  layoutId="activeTab"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab.name}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* Товары */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 mb-6"
        >
          {tabs.find(t => t.id === activeTab)?.items.map(item => {
            const isOwned = ownedItems.has(item.id)
            const isPurchasing = purchasing === item.id

            return (
              <motion.div
                key={item.id}
                whileHover={{ scale: 1.02 }}
                className={`relative overflow-hidden ${
                  isOwned
                    ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20'
                    : 'bg-white/10'
                } backdrop-blur-xl rounded-xl p-5 border border-white/20 shadow-2xl`}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    className="text-5xl"
                    animate={{ rotate: [0, 5, 0, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    {item.preview}
                  </motion.div>
                  <div className="flex-1">
                    <p className="font-bold text-white text-lg">{item.name}</p>
                    <p className="text-sm text-white/70 mb-2">{item.description}</p>
                    {item.gems && (
                      <div className="bg-purple-500/20 backdrop-blur rounded-lg px-3 py-1 border border-purple-400/30 inline-block">
                        <p className="text-xs text-purple-200 font-semibold">
                          +{item.gems} гемов
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {isOwned ? (
                      <div className="bg-green-500/20 backdrop-blur rounded-xl px-4 py-2 border border-green-400/50">
                        <span className="text-green-300 font-bold">✓ Куплено</span>
                      </div>
                    ) : item.price === 0 ? (
                      <div className="bg-blue-500/20 backdrop-blur rounded-xl px-4 py-2 border border-blue-400/50">
                        <span className="text-blue-300 font-bold">Бесплатно</span>
                      </div>
                    ) : (
                      <motion.button
                        onClick={() => handlePurchase(item)}
                        disabled={isPurchasing}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`px-6 py-3 rounded-xl font-bold transition-all shadow-lg overflow-hidden ${
                          item.currency === 'rub'
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                            : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                        } disabled:opacity-50 relative`}
                      >
                        <span className="relative z-10">
                          {isPurchasing ? '...' : formatPrice(item)}
                        </span>
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Специальное предложение */}
        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02 }}
          className="relative overflow-hidden bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-red-500/20 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative flex items-center gap-4">
            <motion.span
              className="text-5xl"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🎉
            </motion.span>
            <div className="flex-1">
              <p className="font-bold text-white text-lg">Специальное предложение!</p>
              <p className="text-sm text-white/80">Удвоенные гемы на первую покупку</p>
            </div>
          </div>
        </motion.div>

        {/* Кнопка назад */}
        <motion.div
          variants={itemVariants}
          className="text-center mt-8"
        >
          <Link
            to="/"
            onClick={() => haptic.light()}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors font-medium"
          >
            <span>←</span>
            <span>Назад в меню</span>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default Shop
