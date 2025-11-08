#!/usr/bin/env node

import { Command } from "commander";
import { buildCommand } from "./commands/build.js";

const program = new Command();

program
  .name("fnly")
  .description("CLI tool for building and deploying serverless functions")
  .version("0.0.0");

program
  .command("build")
  .description("Build API functions from the api folder")
  .action(async () => {
    await buildCommand();
  });

program.parse();
