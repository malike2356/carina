#!/usr/bin/env Rscript

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 1) {
  cat('{"success":false,"error":"Config path required"}')
  quit(status = 1)
}

suppressPackageStartupMessages({
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    cat('{"success":false,"error":"R package jsonlite is required"}')
    quit(status = 1)
  }
  library(jsonlite)
})

fail <- function(message) {
  cat(toJSON(list(success = FALSE, error = message), auto_unbox = TRUE))
  quit(status = 1)
}

config <- tryCatch(fromJSON(args[[1]], simplifyVector = FALSE), error = function(e) {
  fail(paste("Invalid config JSON:", conditionMessage(e)))
})

load_data <- function(path) {
  if (grepl("\\.sav$", path, ignore.case = TRUE)) {
    if (!requireNamespace("haven", quietly = TRUE)) {
      fail("R package haven is required for .sav files")
    }
    return(haven::read_sav(path))
  }
  if (grepl("\\.csv$", path, ignore.case = TRUE)) {
    return(read.csv(path, stringsAsFactors = FALSE))
  }
  fail("Unsupported file type; use .sav or .csv")
}

vars_call <- function(names) {
  as.call(c(quote(jmv::vars), lapply(names, as.name)))
}

run_analysis <- function(data, config) {
  if (!requireNamespace("jmv", quietly = TRUE)) {
    fail("R package jmv is required")
  }

  vars <- unlist(config$variables)
  analysis <- config$analysisType
  options <- if (is.null(config$options)) list() else config$options
  nonparametric <- isTRUE(options$nonparametric)

  switch(
    analysis,
    descriptive = jmv::descriptives(data, vars = eval(vars_call(vars))),
    ttest_independent = {
      if (nonparametric) {
        jmv::ttestIS(data, dep = vars[[1]], group = config$groupBy, tests = TRUE, mann = TRUE)
      } else {
        jmv::ttestIS(data, dep = vars[[1]], group = config$groupBy)
      }
    },
    ttest_paired = jmv::ttestPS(data, pairs = eval(vars_call(vars))),
    ttest_one_sample = jmv::ttestOneS(data, vars = eval(vars_call(vars))),
    anova = {
      if (nonparametric) {
        jmv::anova(data, dep = vars[[1]], factors = config$groupBy, postHoc = TRUE, krush = TRUE)
      } else {
        jmv::anova(data, dep = vars[[1]], factors = config$groupBy)
      }
    },
    chi_square = jmv::contTables(data, rows = vars[[1]], cols = vars[[2]]),
    correlation = jmv::corrMatrix(data, vars = eval(vars_call(vars))),
    regression_linear = {
      dep <- if (!is.null(config$dependentVar)) config$dependentVar else vars[[1]]
      covs <- if (!is.null(config$covariates)) config$covariates else vars
      jmv::linReg(
        data,
        dep = dep,
        covs = eval(vars_call(covs)),
        blocks = list(list("1" = covs))
      )
    },
    regression_logistic = {
      dep <- if (!is.null(config$dependentVar)) config$dependentVar else vars[[1]]
      covs <- if (!is.null(config$covariates)) config$covariates else vars
      jmv::logRegBin(
        data,
        dep = dep,
        covs = eval(vars_call(covs)),
        blocks = list(list("1" = covs))
      )
    },
    factor = jmv::efa(data, vars = eval(vars_call(vars))),
    reliability = jmv::reliability(data, vars = eval(vars_call(vars)), omega = TRUE),
    fail(paste("Unsupported analysis type:", analysis))
  )
}

table_to_json <- function(value, fallback_title) {
  if (is.null(value)) {
    return(NULL)
  }

  df <- tryCatch(
    as.data.frame(value, stringsAsFactors = FALSE),
    error = function(e) NULL
  )
  if (is.null(df) || nrow(df) == 0) {
    return(NULL)
  }

  title <- fallback_title
  if (!is.null(value$title) && nzchar(as.character(value$title))) {
    title <- as.character(value$title)
  }

  rows <- lapply(seq_len(nrow(df)), function(row_index) {
    as.character(unlist(df[row_index, , drop = FALSE], use.names = FALSE))
  })

  list(
    title = title,
    header = colnames(df),
    rows = rows
  )
}

extract_tables <- function(result) {
  tables <- list()
  for (name in names(result)) {
    converted <- table_to_json(result[[name]], name)
    if (!is.null(converted)) {
      tables[[length(tables) + 1]] <- converted
    }
  }
  tables
}

tryCatch({
  data <- load_data(config$dataFile)
  result <- run_analysis(data, config)
  out <- list(
    success = TRUE,
    analysisType = config$analysisType,
    tables = extract_tables(result),
    notes = character(0)
  )
  cat(toJSON(out, auto_unbox = TRUE, pretty = TRUE))
}, error = function(e) {
  fail(conditionMessage(e))
})
