import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const arenaMatches=sqliteTable('arena_matches',{
 code:text('code').primaryKey(),tokenA:text('token_a').notNull(),tokenB:text('token_b'),unitsA:text('units_a').notNull(),unitsB:text('units_b'),map:text('map').notNull(),seed:integer('seed').notNull(),state:text('state'),updated:integer('updated').notNull(),expires:integer('expires').notNull(),revision:integer('revision').notNull().default(0),attacker:text('attacker'),defender:text('defender')
},table=>[index('idx_arena_matches_expires').on(table.expires)]);
export const arenaProfiles=sqliteTable('arena_profiles',{id:text('id').primaryKey(),token:text('token').notNull(),name:text('name').notNull(),units:text('units').notNull(),map:text('map').notNull(),power:integer('power').notNull(),updated:integer('updated').notNull()});
export const arenaResults=sqliteTable('arena_results',{code:text('code').primaryKey(),winner:text('winner').notNull(),loser:text('loser').notNull(),completed:integer('completed').notNull()});
