#!/usr/bin/env node
import { Command } from 'commander'
import { collect } from './commands/collect.js'
import { daily } from './commands/daily.js'
import { weekly } from './commands/weekly.js'
import { serve } from './commands/serve.js'

const program = new Command()

program
  .name('aggregator')
  .description('Information Aggregator CLI')
  .version('1.0.0')

program.command('collect').action(collect)
program.command('daily').action(daily)
program.command('weekly').action(weekly)
program.command('serve').action(serve)

program.parse()
