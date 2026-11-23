/* Shared bridge dialogue for playback and offline voice generation. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BattleVoiceCatalog=factory();})(typeof window==='object'?window:globalThis,()=>{
 const routes={
    direct:['Attack run.','Closing, Captain.'],
    port:['Come to port.','Coming to port.'],
    starboard:['Come to starboard.','Coming to starboard.'],
    above:['Take us above.','Climbing.'],
    below:['Take us below.','Descending.'],
    behind:['Come around astern.','Moving astern.'],
    hide:['Take cover behind K7.','Making for cover.'],
    ram:['Collision course.','Course set. Brace.'],
    close:['Match course. Close in.','Matching course.'],
    chase:['Pursue.','Pursuit course.'],
    distance:['Hold firing range.','Adjusting range.'],
    flee:['Break off. Repair.','Withdrawing.']
  };
 const brief={
  "Cloud-top clearance reached. Deflecting to keep Enterprise above the atmosphere.": "Cloud tops. Correcting altitude.",
  "Updated flight maneuvers applied.": "Course updated.",
  "K7 cover established. Holding six seconds before the assault.": "In cover. Holding six seconds.",
  "Cover route timed out. Beginning the direct assault.": "No cover. Attacking.",
  "Relative position held for over five seconds. Advancing the flight plan.": "No relative movement. Next maneuver.",
  "Selected maneuvers complete. Automatic breakaway before damage review.": "Maneuvers complete. Breaking away.",
  "K7 collision avoidance: deflecting at slow impulse. Steer clear of the station.": "Station collision. Deflecting.",
  "Warp destination obstructed by K7. Change heading before jumping.": "Warp blocked by K7. Change heading.",
  "Warp destination inside the planet. Change heading before jumping.": "Warp blocked by planet. Change heading.",
  "Emergency warp complete: 30 km along current heading and pitch. Warp charge spent.": "Warp complete. Charge spent."
};
 const voices=Object.freeze({captain:'cedar',helm:'marin'});
 const extras={"captain":["Report.","Manual helm."],"helm":["Maneuvers complete. Awaiting orders.","Manual control. Standing by.","Torpedo incoming!","Hull hit!","Warp complete.","Helm lost!","Yorktown disabled."]};
 function lines(){
   const entries=[];
   for(const [order,reply] of Object.values(routes))entries.push({role:'captain',text:order},{role:'helm',text:reply});
   for(const text of Object.values(brief))entries.push({role:'helm',text});
   for(const [role,texts] of Object.entries(extras))for(const text of texts)entries.push({role,text});
   return [...new Map(entries.map(line=>[line.role+'\n'+line.text,line])).values()];
 }
 return {routes,brief,voices,lines};
});
