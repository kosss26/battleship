import { test,expect,uid,resign,sql,userId,expectNoPageErrors } from './helpers.js'

test('PvP shows the opponent set by default, remembers a personal view and reviews both fleets', async ({newPlayer})=>{
  const tag=uid(),nameA=`Арктика ${tag}`,nameB=`Адмирал ${tag}`
  const a=await newPlayer(nameA),b=await newPlayer(nameB)
  for(const [name,equipped] of [[nameA,{theme:'theme_arctic',ship:'ship_arctic',effect:'fx_arctic',frame:'frame_silver'}],[nameB,{theme:'theme_imperial',ship:'ship_royal',effect:'fx_imperial',frame:'frame_neon'}]]) {
    await sql("UPDATE users SET data=jsonb_set(jsonb_set(data,'{equipped}',$1::jsonb),'{owned}',(data->'owned')||$2::jsonb) WHERE id=$3",[JSON.stringify(equipped),JSON.stringify(Object.values(equipped)),await userId(name)])
  }
  await a.reload();await b.reload()
  await expect(a.getByText('Рейтинговый бой')).toBeVisible()
  await a.getByRole('button',{name:'В бой',exact:true}).click()
  await b.getByRole('button',{name:'В бой',exact:true}).click()
  await a.getByRole('button',{name:'Готов к бою'}).click()
  await b.getByRole('button',{name:'Готов к бою'}).click()
  await expect(a.getByText(/Ваш ход|Ход соперника/)).toBeVisible()
  await expect(a.locator('.water').first()).toHaveAttribute('data-board-theme','theme_imperial')
  await expect(a.locator('.water').last()).toHaveAttribute('data-board-theme','theme_arctic')
  await expect(b.locator('.water').first()).toHaveAttribute('data-board-theme','theme_arctic')
  await expect(a.locator('[data-avatar-frame="frame_neon"]')).toBeVisible()
  // Opponent hulls must remain hidden until sunk, whatever cosmetic view is chosen.
  await expect(a.locator('.water').first().locator('[data-ship-model]')).toHaveCount(0)
  await a.getByRole('button',{name:'Моё',exact:true}).click()
  await expect(a.locator('.water').first()).toHaveAttribute('data-board-theme','theme_arctic')
  await a.reload()
  await expect(a.getByRole('button',{name:'Моё',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(a.locator('.water').first()).toHaveAttribute('data-board-theme','theme_arctic')
  await resign(a)
  await expect(a.getByRole('heading',{name:'Поражение'})).toBeVisible()
  await expect(b.getByRole('heading',{name:'Победа!'})).toBeVisible()
  await a.getByRole('button',{name:/Разбор боя/}).click()
  await a.getByRole('button',{name:'Соперника',exact:true}).click()
  await expect(a.locator('[data-report-board] .water')).toHaveAttribute('data-board-theme','theme_imperial')
  await expect(a.locator('[data-report-board] [data-ship-model="imperial"]')).toHaveCount(10)
  await a.getByRole('button',{name:'Ваш флот',exact:true}).click()
  await expect(a.locator('[data-report-board] .water')).toHaveAttribute('data-board-theme','theme_arctic')
  await expect(a.locator('[data-report-board] [data-ship-model="arctic"]')).toHaveCount(10)
  expect(await a.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  expectNoPageErrors(a,b)
})

test('fullscreen requests the native mode and tracks changing Telegram safe areas',async({page})=>{
  await page.route('https://telegram.org/js/telegram-web-app.js*',route=>route.fulfill({contentType:'application/javascript',body:`
    window.__tgCalls=[];window.__tgEvents={};
    window.Telegram={WebApp:{initData:'',platform:'ios',isFullscreen:false,
      isVersionAtLeast:()=>true,ready(){__tgCalls.push('ready')},expand(){__tgCalls.push('expand')},
      requestFullscreen(){__tgCalls.push('fullscreen');this.isFullscreen=true},
      safeAreaInset:{top:47,bottom:34,left:0,right:0},contentSafeAreaInset:{top:44,bottom:0,left:0,right:0},
      disableVerticalSwipes(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},
      onEvent(name,fn){__tgEvents[name]=fn}
    }};
  `}))
  await page.goto('/fleet/regent')
  await expect(page.getByRole('heading',{name:'РЕГЕНТ',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>window.__tgCalls)).toEqual(['ready','expand','fullscreen'])
  await expect(page.locator('html')).toHaveAttribute('data-tg-fullscreen','true')
  expect(await page.locator('.regent-page').evaluate(el=>parseFloat(getComputedStyle(el).paddingTop))).toBe(111)
  await page.evaluate(()=>{Telegram.WebApp.safeAreaInset.top=59;__tgEvents.safeAreaChanged()})
  expect(await page.locator('.regent-page').evaluate(el=>parseFloat(getComputedStyle(el).paddingTop))).toBe(123)
  await page.evaluate(()=>{Telegram.WebApp.isFullscreen=false;__tgEvents.fullscreenFailed()})
  await expect(page.locator('html')).toHaveAttribute('data-tg-fullscreen','false')
  await expect(page.getByRole('heading',{name:'РЕГЕНТ',exact:true})).toBeVisible()
})

test('older Telegram expands safely without requesting unsupported fullscreen',async({page})=>{
  await page.route('https://telegram.org/js/telegram-web-app.js*',route=>route.fulfill({contentType:'application/javascript',body:`
    window.__tgCalls=[];window.Telegram={WebApp:{initData:'',isVersionAtLeast:()=>false,
    ready(){__tgCalls.push('ready')},expand(){__tgCalls.push('expand')},requestFullscreen(){throw Error('unsupported')}}};
  `}))
  await page.goto('/fleet/regent')
  await expect(page.getByRole('heading',{name:'РЕГЕНТ',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>window.__tgCalls)).toEqual(['ready','expand'])
})
