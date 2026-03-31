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

program
  .command('collect')
  .option('--date <YYYY-MM-DD>', 'Specify collection date (default: today)')
  .option('--config <path>', 'Config directory (default: ./config)')
  .option('--output <path>', 'Output directory (default: ./data)')
  .action(collect)
program
  .command('daily')
  .option('--date <YYYY-MM-DD>', 'Specify date (default: yesterday)')
  .option('--input <path>', 'Input JSON path')
  .option('--output <path>', 'Output directory')
  .action(daily)
program
  .command('weekly')
  .option('--week <YYYY-Www>', 'Specify week (default: current week)')
  .option('--input <path>', 'Input JSON path (default: data/)')
  .option('--output <path>', 'Output directory')
  .action(weekly)
program.command('serve').action(serve)

program.parse()
