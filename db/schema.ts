import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const arenaMatches=sqliteTable('arena_matches',{
 code:text('code').primaryKey(),tokenA:text('token_a').notNull(),tokenB:text('token_b'),unitsA:text('units_a').notNull(),unitsB:text('units_b'),map:text('map').notNull(),seed:integer('seed').notNull(),state:text('state'),updated:integer('updated').notNull(),expires:integer('expires').notNull(),revision:integer('revision').notNull().default(0)
},table=>[index('idx_arena_matches_expires').on(table.expires)]);
