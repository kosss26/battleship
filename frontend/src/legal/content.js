/**
 * Terms of Service and Privacy Policy.
 * {operator}, {contact}, {bot} are filled from the server config (LEGAL_OPERATOR, LEGAL_CONTACT, BOT_USERNAME).
 * This is a template: have it reviewed by a lawyer for your jurisdiction before launch.
 */
export const LEGAL_UPDATED = '2026-11-04'

export const LEGAL = {
  terms: {
    ru: {
      title: 'Пользовательское соглашение',
      sections: [
        ['1. Общие положения', [
          'Настоящее соглашение регулирует использование игры «Battleship Online» (далее — Игра), доступной как мини-приложение Telegram через бота {bot}. Оператор Игры — {operator}.',
          'Открывая Игру, вы подтверждаете, что прочитали и принимаете это соглашение и Политику конфиденциальности. Если вы не согласны — не пользуйтесь Игрой.',
          'Игра также подчиняется Условиям использования Telegram и Условиям для мини-приложений и Telegram Stars (telegram.org/tos, telegram.org/tos/mini-apps, telegram.org/tos/stars).',
        ]],
        ['2. Возраст', [
          'Игра предназначена для лиц от 13 лет. Если по законодательству вашей страны для заключения соглашения или совершения покупок требуется согласие родителей, вы подтверждаете, что получили его.',
        ]],
        ['3. Аккаунт', [
          'Аккаунт создаётся автоматически на основе вашего профиля Telegram. Вы отвечаете за действия, совершённые с вашего аккаунта Telegram.',
          'Один человек — один аккаунт. Запрещено использовать несколько аккаунтов для получения выгоды, в том числе для накрутки рейтинга, наград или реферальных бонусов.',
        ]],
        ['4. Правила поведения', [
          'Запрещено: использовать читы, ботов, модификации клиента и уязвимости; договариваться о результатах рейтинговых матчей; выдавать себя за других; оскорблять игроков через имя или аватар; мешать работе Игры.',
          'За нарушения Оператор вправе обнулить рейтинг, списать полученные нечестно ценности, ограничить доступ к рейтинговым режимам или заблокировать аккаунт. Решение о блокировке можно обжаловать по контактам из раздела 10.',
        ]],
        ['5. Виртуальная валюта и предметы', [
          'Золото, кристаллы, бустеры, предметы коллекции, премиум-пропуск и другие внутриигровые ценности (далее — Виртуальные ценности) — это лицензия на использование функций Игры. Они не являются деньгами, электронными средствами платежа или вашей собственностью, не имеют денежной стоимости и не подлежат обмену на деньги, продаже или передаче другим игрокам.',
          'Оператор может изменять баланс Игры, цены, состав наград и предметов. Боевой пропуск действует до конца текущего сезона (календарного месяца, UTC).',
          'Кампания, бустеры и прочие механики Игры не являются азартной игрой: результат определяется навыком, а покупки не дают выигрыша в деньгах.',
        ]],
        ['6. Покупки за Telegram Stars', [
          'Покупки внутри Игры оплачиваются только через Telegram Stars. Платёж обрабатывает Telegram; Оператор не получает данных вашей банковской карты.',
          'Виртуальные ценности зачисляются сразу после подтверждения оплаты. Если покупка не зачислилась в течение 15 минут, напишите боту команду /paysupport.',
          'Поскольку Виртуальные ценности предоставляются немедленно, покупки, как правило, возврату не подлежат, кроме случаев технической ошибки, двойного списания или если возврат требуется по закону или правилам Telegram. При возврате Stars купленные Виртуальные ценности списываются с аккаунта.',
        ]],
        ['7. Рейтинг, сезоны и награды', [
          'Рейтинговый сезон длится календарный месяц (UTC). По итогам сезона игроки, сыгравшие не менее 5 рейтинговых боёв, получают награды по достигнутому званию; рейтинг частично сбрасывается.',
          'Оператор вправе не начислять или аннулировать рейтинг и награды, полученные с нарушением правил (например, в боях с одним и тем же соперником или при досрочной сдаче).',
        ]],
        ['8. Доступность и изменения', [
          'Игра предоставляется «как есть». Оператор стремится к бесперебойной работе, но не гарантирует отсутствия сбоев. При перезапуске сервера текущий бой может быть прерван.',
          'Оператор может обновлять Игру, изменять или прекращать работу отдельных функций и самой Игры. О существенных изменениях соглашения мы сообщим в Игре или через бота; продолжая играть, вы принимаете новую редакцию.',
        ]],
        ['9. Ответственность', [
          'В пределах, разрешённых законом, Оператор не отвечает за косвенные убытки, упущенную выгоду и потерю Виртуальных ценностей из-за действий третьих лиц, сбоев Telegram или нарушения вами правил.',
        ]],
        ['10. Контакты', [
          'Вопросы, жалобы, обжалование блокировок и помощь с оплатой: {contact}.',
        ]],
      ],
    },
    en: {
      title: 'Terms of Service',
      sections: [
        ['1. General', [
          'These Terms govern your use of "Battleship Online" (the "Game"), a Telegram Mini App available via the bot {bot}. The Game is operated by {operator} (the "Operator").',
          'By opening the Game you confirm that you have read and accept these Terms and the Privacy Policy. If you do not agree, do not use the Game.',
          'The Game is also subject to the Telegram Terms of Service and the Terms for Mini Apps and Telegram Stars (telegram.org/tos, telegram.org/tos/mini-apps, telegram.org/tos/stars).',
        ]],
        ['2. Age', [
          'The Game is intended for users aged 13 and over. If your local law requires parental consent to accept these Terms or to make purchases, you confirm that you have it.',
        ]],
        ['3. Account', [
          'Your account is created automatically from your Telegram profile. You are responsible for all actions taken from your Telegram account.',
          'One person — one account. Using multiple accounts to gain an advantage, including boosting rating, rewards or referral bonuses, is prohibited.',
        ]],
        ['4. Conduct', [
          'You must not: use cheats, bots, client modifications or exploits; arrange the outcome of ranked matches; impersonate others; use offensive names or avatars; interfere with the Game.',
          'For violations the Operator may reset rating, remove unfairly obtained items, restrict ranked play or ban the account. Bans can be appealed via the contacts in section 10.',
        ]],
        ['5. Virtual currency and items', [
          'Gold, gems, boosters, collection items, the premium pass and other in-game items ("Virtual Items") are a limited licence to use Game features. They are not money or property, have no monetary value and cannot be exchanged for money, sold or transferred to other players.',
          'The Operator may change game balance, prices, rewards and items. The battle pass is valid until the end of the current season (calendar month, UTC).',
          'Game mechanics are skill-based; purchases never yield monetary winnings. The Game is not gambling.',
        ]],
        ['6. Purchases with Telegram Stars', [
          'In-game purchases are paid exclusively with Telegram Stars. Payments are processed by Telegram; the Operator never receives your card details.',
          'Virtual Items are delivered right after the payment is confirmed. If a purchase has not arrived within 15 minutes, send /paysupport to the bot.',
          'Because Virtual Items are delivered immediately, purchases are generally non-refundable, except for technical errors, duplicate charges, or where a refund is required by law or Telegram rules. When Stars are refunded, the purchased Virtual Items are removed from the account.',
        ]],
        ['7. Rating, seasons and rewards', [
          'A ranked season lasts one calendar month (UTC). Players with at least 5 ranked battles receive end-of-season rewards based on their rank, and ratings are partially reset.',
          'The Operator may withhold or revoke rating and rewards obtained in breach of the rules (e.g. repeated games against the same opponent or instant forfeits).',
        ]],
        ['8. Availability and changes', [
          'The Game is provided "as is". We aim for uninterrupted service but do not guarantee it. A server restart may interrupt a battle in progress.',
          'The Operator may update, change or discontinue features or the Game. We will announce material changes to these Terms in the Game or via the bot; continuing to play means you accept them.',
        ]],
        ['9. Liability', [
          'To the extent permitted by law, the Operator is not liable for indirect losses, lost profits, or loss of Virtual Items caused by third parties, Telegram outages or your breach of these Terms.',
        ]],
        ['10. Contact', [
          'Questions, complaints, ban appeals and payment support: {contact}.',
        ]],
      ],
    },
  },
  privacy: {
    ru: {
      title: 'Политика конфиденциальности',
      sections: [
        ['1. Кто обрабатывает данные', [
          'Оператор персональных данных — {operator}. Связаться с нами: {contact}.',
        ]],
        ['2. Какие данные мы получаем', [
          'Из Telegram при входе: ваш Telegram ID, имя и фамилию, имя пользователя (@username), ссылку на фото профиля, язык интерфейса, признак Telegram Premium. Telegram передаёт их Игре при открытии мини-приложения.',
          'Игровые данные: рейтинг, уровень, статистику и историю боёв, ходы в матчах, внутриигровые покупки и баланс, задания, достижения, список друзей, настройки.',
          'Платежи: идентификатор платежа Telegram, Telegram ID плательщика для возвратов, товар, сезон пропуска, сумму в Stars и дату. Данные банковских карт мы не получаем — оплату обрабатывает Telegram.',
          'Технические данные: IP-адрес и сведения о соединении в журналах сервера, время последнего входа.',
        ]],
        ['3. Зачем мы их используем', [
          'Чтобы создать и вести ваш аккаунт, проводить бои и подбирать соперников; показывать рейтинги, друзей и историю; зачислять покупки и помогать с оплатой; отправлять уведомления от бота (если вы их не отключили); бороться с читерством и злоупотреблениями; улучшать Игру на основе обезличенной статистики.',
          'Основания: исполнение пользовательского соглашения (предоставление Игры), наш законный интерес (безопасность, защита от мошенничества, улучшение Игры) и ваше согласие (уведомления).',
        ]],
        ['4. Кто видит ваши данные', [
          'Другие игроки видят ваше имя, фото, уровень, рейтинг, звание и общую статистику — в рейтингах, у друзей и в бою.',
          'Мы передаём данные только тем, кто помогает работе Игры: Telegram (вход, платежи, сообщения бота) и хостинг-провайдерам, на серверах которых работает Игра. Мы не продаём персональные данные и не передаём их рекламодателям.',
          'Данные могут храниться на серверах за пределами вашей страны. Мы раскроем данные государственным органам только в случаях, прямо предусмотренных законом.',
        ]],
        ['5. Уведомления', [
          'Бот может присылать сообщения о заявках в друзья, вызовах на бой, наградах и напоминания — не чаще одного напоминания в день. Отключить их можно в настройках профиля или заблокировав бота.',
        ]],
        ['6. Сколько храним', [
          'Данные аккаунта хранятся, пока аккаунт существует. Журналы сервера — до 90 дней. Записи о платежах хранятся столько, сколько требуется для учёта и разрешения споров.',
        ]],
        ['7. Ваши права', [
          'Вы можете запросить доступ к своим данным, их исправление или удаление, а также отозвать согласие на уведомления.',
          'Удалить аккаунт можно самостоятельно: Профиль → «Удалить аккаунт». Мы удалим имя, фото, username и связь игрового профиля с вашим Telegram, сотрём список друзей. Обезличенные записи о боях сохраняются для истории других игроков. Платёжные записи, включая Telegram ID плательщика, сохраняются для учёта, возвратов и разрешения споров. Удаление необратимо: прогресс и покупки будут потеряны.',
          'По остальным запросам пишите: {contact}. Мы ответим в течение 30 дней. Вы также вправе обратиться в надзорный орган по защите данных вашей страны.',
        ]],
        ['8. Дети', [
          'Игра не предназначена для детей младше 13 лет. Если вы узнали, что ребёнок младше 13 лет передал нам данные, напишите нам — мы удалим их.',
        ]],
        ['9. Безопасность', [
          'Мы проверяем подпись данных Telegram при каждом входе, передаём данные по защищённому соединению и ограничиваем доступ к ним. Тем не менее ни одна система не защищена полностью.',
        ]],
        ['10. Изменения', [
          'Мы можем обновлять эту политику. Актуальная редакция всегда доступна в Игре и по команде /privacy в боте.',
        ]],
      ],
    },
    en: {
      title: 'Privacy Policy',
      sections: [
        ['1. Who we are', [
          'The data controller is {operator}. Contact us: {contact}.',
        ]],
        ['2. Data we collect', [
          'From Telegram when you sign in: your Telegram ID, first and last name, username, profile photo URL, interface language and Telegram Premium status. Telegram provides these to the Game when you open the Mini App.',
          'Game data: rating, level, statistics and battle history, moves made in matches, in-game purchases and balances, quests, achievements, friends list and settings.',
          'Payments: the Telegram payment ID, payer Telegram ID for refunds, product, pass season, amount in Stars and date. We never receive card details — payments are processed by Telegram.',
          'Technical data: IP address and connection details in server logs, time of last visit.',
        ]],
        ['3. How we use it', [
          'To create and run your account, host battles and matchmaking; show leaderboards, friends and history; deliver purchases and provide payment support; send bot notifications (unless you turn them off); prevent cheating and abuse; improve the Game using aggregated statistics.',
          'Legal bases: performance of the Terms of Service (providing the Game), our legitimate interests (security, fraud prevention, improving the Game) and your consent (notifications).',
        ]],
        ['4. Who can see your data', [
          'Other players see your name, photo, level, rating, rank and general statistics — in leaderboards, friends lists and battles.',
          'We share data only with parties that help run the Game: Telegram (sign-in, payments, bot messages) and our hosting providers. We do not sell personal data or share it with advertisers.',
          'Data may be stored on servers outside your country. We disclose data to authorities only where the law requires it.',
        ]],
        ['5. Notifications', [
          'The bot may message you about friend requests, battle challenges, rewards and reminders — at most one reminder a day. Turn them off in Profile settings or by blocking the bot.',
        ]],
        ['6. Retention', [
          'Account data is kept while the account exists. Server logs are kept for up to 90 days. Payment records are kept as long as needed for accounting and dispute resolution.',
        ]],
        ['7. Your rights', [
          'You may request access to, correction or deletion of your data and withdraw consent to notifications.',
          'You can delete your account yourself: Profile → "Delete account". We erase your name, photo, username and the link between your game profile and Telegram, and remove your friends list. Anonymised battle records remain for other players’ history. Payment records, including the payer Telegram ID, are retained for accounting, refunds and disputes. Deletion is irreversible: progress and purchases are lost.',
          'For other requests contact {contact}. We reply within 30 days. You may also complain to your local data protection authority.',
        ]],
        ['8. Children', [
          'The Game is not intended for children under 13. If you believe a child under 13 has given us personal data, contact us and we will delete it.',
        ]],
        ['9. Security', [
          'We verify the Telegram data signature on every sign-in, use encrypted connections and restrict access to data. No system is completely secure, however.',
        ]],
        ['10. Changes', [
          'We may update this policy. The current version is always available in the Game and via the /privacy bot command.',
        ]],
      ],
    },
  },
}
