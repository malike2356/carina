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
    if (!requireNamespace("haven", quietly = TRUE)) fail("R package haven is required for .sav files")
    return(haven::read_sav(path))
  }
  if (grepl("\\.csv$", path, ignore.case = TRUE)) {
    return(read.csv(path, stringsAsFactors = FALSE))
  }
  fail("Unsupported file type; use .sav or .csv")
}

run_analysis <- function(data, config) {
  if (!requireNamespace("broom", quietly = TRUE)) fail("R package broom is required")
  suppressPackageStartupMessages(library(broom))

  vars <- unlist(config$variables)
  analysis <- config$analysisType

  switch(
    analysis,
    descriptive = {
      if (!requireNamespace("psych", quietly = TRUE)) fail("R package psych is required for descriptives")
      desc <- psych::describe(data[, vars, drop = FALSE])
      list(type = "table", title = "Descriptives", rows = as.data.frame(desc))
    },
    ttest = {
      var <- vars[[1]]
      test <- t.test(as.formula(paste(var, "~", config$groupBy)), data = data)
      tidy(test)
    },
    anova = {
      var <- vars[[1]]
      model <- aov(as.formula(paste(var, "~", config$groupBy)), data = data)
      tidy(model)
    },
    correlation = {
      mat <- cor(data[, vars, drop = FALSE], use = "pairwise.complete.obs")
      list(type = "matrix", matrix = mat)
    },
    regression = {
      dep <- config$dependentVar
      ivs <- if (!is.null(config$independentVars)) unlist(config$independentVars) else vars
      formula <- as.formula(paste(dep, "~", paste(ivs, collapse = " + ")))
      model <- lm(formula, data = data)
      list(
        model = tidy(model),
        glance = glance(model)
      )
    },
    `chi-square` = {
      tbl <- table(data[[vars[[1]]]], data[[vars[[2]]]])
      test <- chisq.test(tbl)
      list(table = as.data.frame.matrix(tbl), test = tidy(test))
    },
    factor = {
      if (!requireNamespace("psych", quietly = TRUE)) fail("R package psych is required for factor analysis")
      fa_result <- psych::fa(data[, vars, drop = FALSE], nfactors = 1, rotate = "varimax")
      list(loadings = as.data.frame(unclass(fa_result$loadings)))
    },
    reliability = {
      if (!requireNamespace("psych", quietly = TRUE)) fail("R package psych is required for reliability")
      alpha_result <- psych::alpha(data[, vars, drop = FALSE])
      as.data.frame(alpha_result$total)
    },
    fail(paste("Unsupported analysis type:", analysis))
  )
}

to_rows <- function(value) {
  if (is.data.frame(value)) {
    return(list(list(
      title = "Results",
      header = colnames(value),
      rows = lapply(seq_len(nrow(value)), function(i) as.character(unlist(value[i, ], use.names = FALSE)))
    )))
  }
  if (is.list(value) && !is.null(value$model) && is.data.frame(value$model)) {
    rows <- list()
    if (is.data.frame(value$glance)) {
      rows[[length(rows) + 1]] <- list(
        title = "Model summary",
        header = colnames(value$glance),
        rows = lapply(seq_len(nrow(value$glance)), function(i) as.character(unlist(value$glance[i, ], use.names = FALSE)))
      )
    }
    rows[[length(rows) + 1]] <- list(
      title = "Coefficients",
      header = colnames(value$model),
      rows = lapply(seq_len(nrow(value$model)), function(i) as.character(unlist(value$model[i, ], use.names = FALSE)))
    )
    return(rows)
  }
  list()
}

tryCatch({
  data <- load_data(config$dataFile)
  result <- run_analysis(data, config)
  tables <- to_rows(result)
  out <- list(
    success = TRUE,
    analysisType = config$analysisType,
    tables = tables,
    notes = character(0)
  )
  cat(toJSON(out, auto_unbox = TRUE, pretty = TRUE))
}, error = function(e) {
  fail(conditionMessage(e))
})
