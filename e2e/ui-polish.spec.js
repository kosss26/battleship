import {test,expect,uid,userId,sql,expectNoPageErrors} from './helpers.js'
import {ACHIEVEMENTS} from '../shared/catalog.js'

test('profile medals match the actual achievements and the Regent portrait fills its frame',async({newPlayer})=>{
  const name=`Капитан ${uid()}`,page=await newPlayer(name),id=await userId(name)
  const awards=[['sunk','ship'],['bestHitChain','target'],['bestStreak','bolt'],['referrals','friends']].map(([stat,type])=>({award:ACHIEVEMENTS.find(a=>a.stat===stat),type}))
  const earned=Object.fromEntries(awards.map(({award})=>[award.id,1]));earned.retired_award=1
  await sql("UPDATE users SET photo_url='/art/naval/hero.webp',data=jsonb_set(jsonb_set(jsonb_set(data,'{achievements}',$1::jsonb),'{equipped,frame}','\"frame_regent\"'),'{owned}',(data->'owned')||'[\"frame_regent\"]'::jsonb) WHERE id=$2",[JSON.stringify(earned),id])
  await page.goto('/profile')
  await expect(page.locator('.identity-achievements-heading')).toContainText(`4 / ${ACHIEVEMENTS.length}`)
  const shown=await page.locator('.identity-medal-shelf [data-achievement-id]').evaluateAll(els=>els.map(el=>({id:el.dataset.achievementId,type:el.querySelector('[data-medal-type]').dataset.medalType})))
  for(const {id,type} of shown) expect(type).toBe(awards.find(x=>x.award.id===id).type)
  const portrait=page.locator('.identity-dossier [data-avatar-frame="frame_regent"]')
  const checkFace=async()=>{
    // Measure in one frame: the route may still be moving into place.
    const {outer,face,photo,frame}=await portrait.evaluate(el=>({outer:el.getBoundingClientRect().toJSON(),face:el.querySelector('[data-avatar-face]').getBoundingClientRect().toJSON(),photo:el.querySelector('img').getBoundingClientRect().toJSON(),frame:el.querySelector('.regent-avatar-frame').getBoundingClientRect().toJSON()}))
    expect(Math.abs(outer.width*.81-face.width)).toBeLessThan(1)
    expect(Math.abs((face.x+face.width/2)-(outer.x+outer.width/2))).toBeLessThan(.6)
    expect(Math.abs((face.y+face.height/2)-(outer.y+outer.height/2))).toBeLessThan(.6)
    expect(Math.abs(photo.width-face.width)).toBeLessThan(.6)
    expect(Math.abs(photo.height-face.height)).toBeLessThan(.6)
    expect(Math.abs(frame.width-outer.width)).toBeLessThan(.6)
  }
  await checkFace();await page.setViewportSize({width:320,height:740});await checkFace()
  await page.locator('.identity-achievements').click()
  for(const {id,type} of shown) await expect(page.locator(`article[data-achievement-id="${id}"] [data-medal-type]`)).toHaveAttribute('data-medal-type',type)
  await page.goto('/shop?tab=collection');await page.getByRole('button',{name:'Рамки',exact:true}).click()
  const shopAvatar=page.locator('[data-avatar-frame="frame_regent"]').first()
  await expect(shopAvatar.locator('.regent-avatar-frame')).toBeVisible()
  expectNoPageErrors(page)
})

test('season result and reward dialogs use the naval surface, remain inside the viewport and unlock scroll',async({newPlayer})=>{
  const name=`Сезонный ${uid()}`,page=await newPlayer(name),id=await userId(name)
  await sql("INSERT INTO season_results(season,user_id,rating,rank,place,games,wins,reward) VALUES('2026-10',$1,1720,'captain',7,24,16,$2)",[id,{gems:160,cosmetics:['frame_officer']}])
  await page.setViewportSize({width:320,height:640});await page.goto('/')
  const result=page.getByRole('dialog',{name:'Итоги сезона',exact:true})
  await expect(result).toBeVisible()
  expect(await result.evaluate(el=>el.closest('.naval-overlay').parentElement===document.body)).toBe(true)
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden')
  const bounds=await result.boundingBox();expect(bounds.y).toBeGreaterThanOrEqual(15);expect(bounds.y+bounds.height).toBeLessThanOrEqual(625)
  await page.keyboard.press('Escape');await expect(result).toBeVisible()
  await result.getByRole('button',{name:'Забрать',exact:true}).click()
  const reward=page.getByRole('dialog',{name:'Награды',exact:true})
  await expect(reward.locator('.naval-reward-popup')).toBeVisible()
  await expect(reward.locator('.naval-modal-icon svg')).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await reward.evaluate(el=>el.contains(document.activeElement))).toBe(true)
  await page.getByRole('button',{name:'OK',exact:true}).click()
  await expect(page.locator('.naval-modal-panel')).toHaveCount(0)
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden')
  expectNoPageErrors(page)
})
