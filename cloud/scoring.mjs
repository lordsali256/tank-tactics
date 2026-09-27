// Fixed points; callers supply authoritative combat state online.
export function battlePoints(win,units,team='player'){
 const defeated=units.filter(u=>u.team!==team&&u.hp<=0).length;
 const surviving=units.filter(u=>u.team===team&&u.hp>0).length;
 const outcome=win?100:20,eliminations=defeated*25,survival=surviving*10;
 return {total:outcome+eliminations+survival,outcome,eliminations,survival};
}
