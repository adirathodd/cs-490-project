"""
UC-078 Technical Interview Preparation generator powered by Gemini.

Builds a comprehensive prep plan per job by prompting Gemini to return
structured JSON (coding challenges, system design prompts, case studies,
and whiteboarding drills). No static questions are embedded here—Gemini
is responsible for producing the actual content.
"""

from __future__ import annotations

import concurrent.futures
import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Callable, Dict, List, Optional

import os
import random
import re
import time
import requests
from django.conf import settings
from json import JSONDecoder, JSONDecodeError

from core.skills_gap_analysis import SkillsGapAnalyzer
from google.api_core import exceptions as google_exceptions

try:
    from google import genai
except ImportError:  # pragma: no cover - library installed at runtime
    genai = None

logger = logging.getLogger(__name__)
RECOVERABLE_GEMINI_ERRORS = (
    ValueError,
    TimeoutError,
    google_exceptions.GoogleAPIError,
    requests.exceptions.RequestException,
)

NEETCODE_BASE_PROBLEMS = [
    {"slug": "two-sum", "title": "Two Sum", "difficulty": "entry"},
    {"slug": "contains-duplicate", "title": "Contains Duplicate", "difficulty": "entry"},
    {"slug": "valid-anagram", "title": "Valid Anagram", "difficulty": "entry"},
    {"slug": "group-anagrams", "title": "Group Anagrams", "difficulty": "mid"},
    {"slug": "top-k-frequent-elements", "title": "Top K Frequent Elements", "difficulty": "mid"},
    {"slug": "product-of-array-except-self", "title": "Product of Array Except Self", "difficulty": "mid"},
    {"slug": "valid-sudoku", "title": "Valid Sudoku", "difficulty": "mid"},
    {"slug": "longest-consecutive-sequence", "title": "Longest Consecutive Sequence", "difficulty": "mid"},
    {"slug": "valid-palindrome", "title": "Valid Palindrome", "difficulty": "entry"},
    {"slug": "two-sum-ii-input-array-is-sorted", "title": "Two Sum II", "difficulty": "entry"},
    {"slug": "3sum", "title": "3Sum", "difficulty": "mid"},
    {"slug": "container-with-most-water", "title": "Container With Most Water", "difficulty": "mid"},
    {"slug": "trapping-rain-water", "title": "Trapping Rain Water", "difficulty": "senior"},
    {"slug": "backspace-string-compare", "title": "Backspace String Compare", "difficulty": "entry"},
    {"slug": "is-subsequence", "title": "Is Subsequence", "difficulty": "entry"},
    {"slug": "best-time-to-buy-and-sell-stock", "title": "Best Time to Buy and Sell Stock", "difficulty": "entry"},
    {"slug": "longest-substring-without-repeating-characters", "title": "Longest Substring Without Repeating Characters", "difficulty": "mid"},
    {"slug": "longest-repeating-character-replacement", "title": "Longest Repeating Character Replacement", "difficulty": "mid"},
    {"slug": "permutation-in-string", "title": "Permutation in String", "difficulty": "mid"},
    {"slug": "minimum-window-substring", "title": "Minimum Window Substring", "difficulty": "senior"},
    {"slug": "sliding-window-maximum", "title": "Sliding Window Maximum", "difficulty": "senior"},
    {"slug": "valid-parentheses", "title": "Valid Parentheses", "difficulty": "entry"},
    {"slug": "min-stack", "title": "Min Stack", "difficulty": "entry"},
    {"slug": "evaluate-reverse-polish-notation", "title": "Evaluate Reverse Polish Notation", "difficulty": "mid"},
    {"slug": "generate-parentheses", "title": "Generate Parentheses", "difficulty": "mid"},
    {"slug": "daily-temperatures", "title": "Daily Temperatures", "difficulty": "mid"},
    {"slug": "car-fleet", "title": "Car Fleet", "difficulty": "mid"},
    {"slug": "largest-rectangle-in-histogram", "title": "Largest Rectangle in Histogram", "difficulty": "senior"},
    {"slug": "binary-search", "title": "Binary Search", "difficulty": "entry"},
    {"slug": "search-a-2d-matrix", "title": "Search a 2D Matrix", "difficulty": "entry"},
    {"slug": "koko-eating-bananas", "title": "Koko Eating Bananas", "difficulty": "mid"},
    {"slug": "find-minimum-in-rotated-sorted-array", "title": "Find Minimum in Rotated Sorted Array", "difficulty": "mid"},
    {"slug": "search-in-rotated-sorted-array", "title": "Search in Rotated Sorted Array", "difficulty": "mid"},
    {"slug": "time-based-key-value-store", "title": "Time Based Key-Value Store", "difficulty": "senior"},
    {"slug": "median-of-two-sorted-arrays", "title": "Median of Two Sorted Arrays", "difficulty": "senior"},
    {"slug": "find-k-closest-elements", "title": "Find K Closest Elements", "difficulty": "mid"},
    {"slug": "reverse-linked-list", "title": "Reverse Linked List", "difficulty": "entry"},
    {"slug": "merge-two-sorted-lists", "title": "Merge Two Sorted Lists", "difficulty": "entry"},
    {"slug": "reorder-list", "title": "Reorder List", "difficulty": "mid"},
    {"slug": "remove-nth-node-from-end-of-list", "title": "Remove Nth Node From End of List", "difficulty": "mid"},
    {"slug": "copy-list-with-random-pointer", "title": "Copy List with Random Pointer", "difficulty": "mid"},
    {"slug": "add-two-numbers", "title": "Add Two Numbers", "difficulty": "mid"},
    {"slug": "linked-list-cycle", "title": "Linked List Cycle", "difficulty": "entry"},
    {"slug": "find-the-duplicate-number", "title": "Find the Duplicate Number", "difficulty": "mid"},
    {"slug": "lru-cache", "title": "LRU Cache", "difficulty": "senior"},
    {"slug": "merge-k-sorted-lists", "title": "Merge k Sorted Lists", "difficulty": "senior"},
    {"slug": "invert-binary-tree", "title": "Invert Binary Tree", "difficulty": "entry"},
    {"slug": "maximum-depth-of-binary-tree", "title": "Maximum Depth of Binary Tree", "difficulty": "entry"},
    {"slug": "diameter-of-binary-tree", "title": "Diameter of Binary Tree", "difficulty": "mid"},
    {"slug": "balanced-binary-tree", "title": "Balanced Binary Tree", "difficulty": "entry"},
    {"slug": "same-tree", "title": "Same Tree", "difficulty": "entry"},
    {"slug": "subtree-of-another-tree", "title": "Subtree of Another Tree", "difficulty": "entry"},
    {"slug": "lowest-common-ancestor-of-a-binary-search-tree", "title": "Lowest Common Ancestor of a BST", "difficulty": "entry"},
    {"slug": "binary-tree-level-order-traversal", "title": "Binary Tree Level Order Traversal", "difficulty": "mid"},
    {"slug": "binary-tree-right-side-view", "title": "Binary Tree Right Side View", "difficulty": "mid"},
    {"slug": "count-good-nodes-in-binary-tree", "title": "Count Good Nodes in Binary Tree", "difficulty": "mid"},
    {"slug": "construct-binary-tree-from-preorder-and-inorder-traversal", "title": "Construct Binary Tree from Preorder and Inorder Traversal", "difficulty": "senior"},
    {"slug": "serialize-and-deserialize-binary-tree", "title": "Serialize and Deserialize Binary Tree", "difficulty": "senior"},
    {"slug": "validate-binary-search-tree", "title": "Validate Binary Search Tree", "difficulty": "mid"},
    {"slug": "kth-smallest-element-in-a-bst", "title": "Kth Smallest Element in a BST", "difficulty": "mid"},
    {"slug": "binary-tree-maximum-path-sum", "title": "Binary Tree Maximum Path Sum", "difficulty": "senior"},
    {"slug": "implement-trie-prefix-tree", "title": "Implement Trie (Prefix Tree)", "difficulty": "mid"},
    {"slug": "design-add-and-search-words-data-structure", "title": "Design Add and Search Words Data Structure", "difficulty": "mid"},
    {"slug": "word-search-ii", "title": "Word Search II", "difficulty": "senior"},
    {"slug": "subsets", "title": "Subsets", "difficulty": "mid"},
    {"slug": "combination-sum", "title": "Combination Sum", "difficulty": "mid"},
    {"slug": "permutations", "title": "Permutations", "difficulty": "mid"},
    {"slug": "subsets-ii", "title": "Subsets II", "difficulty": "mid"},
    {"slug": "combination-sum-ii", "title": "Combination Sum II", "difficulty": "mid"},
    {"slug": "palindrome-partitioning", "title": "Palindrome Partitioning", "difficulty": "mid"},
    {"slug": "letter-combinations-of-a-phone-number", "title": "Letter Combinations of a Phone Number", "difficulty": "entry"},
    {"slug": "word-search", "title": "Word Search", "difficulty": "mid"},
    {"slug": "kth-largest-element-in-an-array", "title": "Kth Largest Element in an Array", "difficulty": "mid"},
    {"slug": "last-stone-weight", "title": "Last Stone Weight", "difficulty": "entry"},
    {"slug": "k-closest-points-to-origin", "title": "K Closest Points to Origin", "difficulty": "mid"},
    {"slug": "task-scheduler", "title": "Task Scheduler", "difficulty": "mid"},
    {"slug": "design-twitter", "title": "Design Twitter", "difficulty": "senior"},
    {"slug": "find-median-from-data-stream", "title": "Find Median from Data Stream", "difficulty": "senior"},
    {"slug": "reorganize-string", "title": "Reorganize String", "difficulty": "mid"},
    {"slug": "insert-interval", "title": "Insert Interval", "difficulty": "mid"},
    {"slug": "merge-intervals", "title": "Merge Intervals", "difficulty": "mid"},
    {"slug": "non-overlapping-intervals", "title": "Non-overlapping Intervals", "difficulty": "mid"},
    {"slug": "meeting-rooms", "title": "Meeting Rooms", "difficulty": "entry"},
    {"slug": "meeting-rooms-ii", "title": "Meeting Rooms II", "difficulty": "mid"},
    {"slug": "minimum-number-of-arrows-to-burst-balloons", "title": "Minimum Number of Arrows to Burst Balloons", "difficulty": "mid"},
    {"slug": "interval-list-intersections", "title": "Interval List Intersections", "difficulty": "entry"},
    {"slug": "maximum-subarray", "title": "Maximum Subarray", "difficulty": "entry"},
    {"slug": "jump-game", "title": "Jump Game", "difficulty": "mid"},
    {"slug": "jump-game-ii", "title": "Jump Game II", "difficulty": "mid"},
    {"slug": "gas-station", "title": "Gas Station", "difficulty": "mid"},
    {"slug": "hand-of-straights", "title": "Hand of Straights", "difficulty": "mid"},
    {"slug": "merge-triplets-to-form-target-array", "title": "Merge Triplets to Form Target Array", "difficulty": "mid"},
    {"slug": "partition-labels", "title": "Partition Labels", "difficulty": "entry"},
    {"slug": "boats-to-save-people", "title": "Boats to Save People", "difficulty": "mid"},
    {"slug": "clone-graph", "title": "Clone Graph", "difficulty": "mid"},
    {"slug": "course-schedule", "title": "Course Schedule", "difficulty": "mid"},
    {"slug": "course-schedule-ii", "title": "Course Schedule II", "difficulty": "mid"},
    {"slug": "pacific-atlantic-water-flow", "title": "Pacific Atlantic Water Flow", "difficulty": "mid"},
    {"slug": "number-of-islands", "title": "Number of Islands", "difficulty": "mid"},
    {"slug": "graph-valid-tree", "title": "Graph Valid Tree", "difficulty": "mid"},
    {"slug": "word-ladder", "title": "Word Ladder", "difficulty": "senior"},
    {"slug": "maximum-area-of-island", "title": "Max Area of Island", "difficulty": "entry"},
    {"slug": "rotting-oranges", "title": "Rotting Oranges", "difficulty": "mid"},
    {"slug": "surrounded-regions", "title": "Surrounded Regions", "difficulty": "mid"},
    {"slug": "evaluate-division", "title": "Evaluate Division", "difficulty": "mid"},
    {"slug": "walls-and-gates", "title": "Walls and Gates", "difficulty": "mid"},
    {"slug": "find-eventual-safe-states", "title": "Find Eventual Safe States", "difficulty": "mid"},
    {"slug": "network-delay-time", "title": "Network Delay Time", "difficulty": "mid"},
    {"slug": "shortest-path-with-alternating-colors", "title": "Shortest Path with Alternating Colors", "difficulty": "senior"},
    {"slug": "minimum-height-trees", "title": "Minimum Height Trees", "difficulty": "mid"},
    {"slug": "alien-dictionary", "title": "Alien Dictionary", "difficulty": "senior"},
    {"slug": "cheapest-flights-within-k-stops", "title": "Cheapest Flights Within K Stops", "difficulty": "mid"},
    {"slug": "swim-in-rising-water", "title": "Swim in Rising Water", "difficulty": "senior"},
    {"slug": "minimum-cost-to-connect-all-points", "title": "Min Cost to Connect All Points", "difficulty": "senior"},
    {"slug": "number-of-ways-to-arrive-at-destination", "title": "Number of Ways to Arrive at Destination", "difficulty": "mid"},
    {"slug": "bus-routes", "title": "Bus Routes", "difficulty": "senior"},
    {"slug": "climbing-stairs", "title": "Climbing Stairs", "difficulty": "entry"},
    {"slug": "min-cost-climbing-stairs", "title": "Min Cost Climbing Stairs", "difficulty": "entry"},
    {"slug": "house-robber", "title": "House Robber", "difficulty": "entry"},
    {"slug": "house-robber-ii", "title": "House Robber II", "difficulty": "mid"},
    {"slug": "longest-palindromic-substring", "title": "Longest Palindromic Substring", "difficulty": "mid"},
    {"slug": "palindromic-substrings", "title": "Palindromic Substrings", "difficulty": "mid"},
    {"slug": "decode-ways", "title": "Decode Ways", "difficulty": "mid"},
    {"slug": "coin-change", "title": "Coin Change", "difficulty": "mid"},
    {"slug": "maximum-product-subarray", "title": "Maximum Product Subarray", "difficulty": "mid"},
    {"slug": "word-break", "title": "Word Break", "difficulty": "mid"},
    {"slug": "longest-increasing-subsequence", "title": "Longest Increasing Subsequence", "difficulty": "mid"},
    {"slug": "partition-equal-subset-sum", "title": "Partition Equal Subset Sum", "difficulty": "mid"},
    {"slug": "combination-sum-iv", "title": "Combination Sum IV", "difficulty": "mid"},
    {"slug": "unique-paths", "title": "Unique Paths", "difficulty": "entry"},
    {"slug": "longest-common-subsequence", "title": "Longest Common Subsequence", "difficulty": "mid"},
    {"slug": "coin-change-ii", "title": "Coin Change II", "difficulty": "mid"},
    {"slug": "target-sum", "title": "Target Sum", "difficulty": "mid"},
    {"slug": "interleaving-string", "title": "Interleaving String", "difficulty": "senior"},
    {"slug": "edit-distance", "title": "Edit Distance", "difficulty": "senior"},
    {"slug": "burst-balloons", "title": "Burst Balloons", "difficulty": "senior"},
    {"slug": "regular-expression-matching", "title": "Regular Expression Matching", "difficulty": "senior"},
    {"slug": "minimum-path-sum", "title": "Minimum Path Sum", "difficulty": "entry"},
    {"slug": "triangle", "title": "Triangle", "difficulty": "mid"},
    {"slug": "single-number", "title": "Single Number", "difficulty": "entry"},
    {"slug": "number-of-1-bits", "title": "Number of 1 Bits", "difficulty": "entry"},
    {"slug": "counting-bits", "title": "Counting Bits", "difficulty": "entry"},
    {"slug": "reverse-bits", "title": "Reverse Bits", "difficulty": "entry"},
    {"slug": "missing-number", "title": "Missing Number", "difficulty": "entry"},
    {"slug": "rotate-image", "title": "Rotate Image", "difficulty": "mid"},
    {"slug": "spiral-matrix", "title": "Spiral Matrix", "difficulty": "mid"},
    {"slug": "set-matrix-zeroes", "title": "Set Matrix Zeroes", "difficulty": "mid"},
    {"slug": "happy-number", "title": "Happy Number", "difficulty": "entry"},
    {"slug": "powx-n", "title": "Pow(x, n)", "difficulty": "mid"},
    {"slug": "multiply-strings", "title": "Multiply Strings", "difficulty": "mid"},
]

ADDITIONAL_LEETCODE_PROBLEMS = [
    {"slug": "binary-tree-zigzag-level-order-traversal", "title": "Binary Tree Zigzag Level Order Traversal", "difficulty": "mid"},
    {"slug": "symmetric-tree", "title": "Symmetric Tree", "difficulty": "entry"},
    {"slug": "path-sum", "title": "Path Sum", "difficulty": "entry"},
    {"slug": "path-sum-ii", "title": "Path Sum II", "difficulty": "mid"},
    {"slug": "flatten-binary-tree-to-linked-list", "title": "Flatten Binary Tree to Linked List", "difficulty": "mid"},
    {"slug": "populating-next-right-pointers-in-each-node", "title": "Populating Next Right Pointers in Each Node", "difficulty": "mid"},
    {"slug": "populating-next-right-pointers-in-each-node-ii", "title": "Populating Next Right Pointers in Each Node II", "difficulty": "mid"},
    {"slug": "binary-tree-paths", "title": "Binary Tree Paths", "difficulty": "entry"},
    {"slug": "convert-sorted-array-to-binary-search-tree", "title": "Convert Sorted Array to Binary Search Tree", "difficulty": "entry"},
    {"slug": "convert-sorted-list-to-binary-search-tree", "title": "Convert Sorted List to Binary Search Tree", "difficulty": "mid"},
    {"slug": "binary-search-tree-iterator", "title": "Binary Search Tree Iterator", "difficulty": "mid"},
    {"slug": "lowest-common-ancestor-of-a-binary-tree", "title": "Lowest Common Ancestor of a Binary Tree", "difficulty": "mid"},
    {"slug": "recover-binary-search-tree", "title": "Recover Binary Search Tree", "difficulty": "senior"},
    {"slug": "unique-binary-search-trees", "title": "Unique Binary Search Trees", "difficulty": "mid"},
    {"slug": "unique-binary-search-trees-ii", "title": "Unique Binary Search Trees II", "difficulty": "senior"},
    {"slug": "range-sum-query-immutable", "title": "Range Sum Query - Immutable", "difficulty": "entry"},
    {"slug": "range-sum-query-2d-immutable", "title": "Range Sum Query 2D - Immutable", "difficulty": "mid"},
    {"slug": "range-sum-query-mutable", "title": "Range Sum Query - Mutable", "difficulty": "senior"},
    {"slug": "count-of-smaller-numbers-after-self", "title": "Count of Smaller Numbers After Self", "difficulty": "senior"},
    {"slug": "reverse-linked-list-ii", "title": "Reverse Linked List II", "difficulty": "mid"},
    {"slug": "palindrome-linked-list", "title": "Palindrome Linked List", "difficulty": "entry"},
    {"slug": "remove-duplicates-from-sorted-list", "title": "Remove Duplicates from Sorted List", "difficulty": "entry"},
    {"slug": "remove-duplicates-from-sorted-list-ii", "title": "Remove Duplicates from Sorted List II", "difficulty": "mid"},
    {"slug": "partition-list", "title": "Partition List", "difficulty": "mid"},
    {"slug": "sort-list", "title": "Sort List", "difficulty": "mid"},
    {"slug": "rotate-list", "title": "Rotate List", "difficulty": "mid"},
    {"slug": "odd-even-linked-list", "title": "Odd Even Linked List", "difficulty": "entry"},
    {"slug": "design-skiplist", "title": "Design Skiplist", "difficulty": "senior"},
    {"slug": "binary-tree-vertical-order-traversal", "title": "Binary Tree Vertical Order Traversal", "difficulty": "mid"},
    {"slug": "vertical-order-traversal-of-a-binary-tree", "title": "Vertical Order Traversal of a Binary Tree", "difficulty": "senior"},
    {"slug": "all-nodes-distance-k-in-binary-tree", "title": "All Nodes Distance K in Binary Tree", "difficulty": "mid"},
    {"slug": "construct-binary-tree-from-inorder-and-postorder-traversal", "title": "Construct Binary Tree from Inorder and Postorder Traversal", "difficulty": "senior"},
    {"slug": "maximum-width-of-binary-tree", "title": "Maximum Width of Binary Tree", "difficulty": "mid"},
    {"slug": "boundary-of-binary-tree", "title": "Boundary of Binary Tree", "difficulty": "senior"},
    {"slug": "kth-smallest-number-in-multiplication-table", "title": "Kth Smallest Number in Multiplication Table", "difficulty": "senior"},
    {"slug": "find-first-and-last-position-of-element-in-sorted-array", "title": "Find First and Last Position of Element in Sorted Array", "difficulty": "mid"},
    {"slug": "first-bad-version", "title": "First Bad Version", "difficulty": "entry"},
    {"slug": "guess-number-higher-or-lower", "title": "Guess Number Higher or Lower", "difficulty": "entry"},
    {"slug": "sqrtx", "title": "Sqrt(x)", "difficulty": "entry"},
    {"slug": "divide-two-integers", "title": "Divide Two Integers", "difficulty": "mid"},
    {"slug": "palindrome-number", "title": "Palindrome Number", "difficulty": "entry"},
    {"slug": "roman-to-integer", "title": "Roman to Integer", "difficulty": "entry"},
    {"slug": "integer-to-roman", "title": "Integer to Roman", "difficulty": "mid"},
    {"slug": "string-to-integer-atoi", "title": "String to Integer (atoi)", "difficulty": "mid"},
    {"slug": "zigzag-conversion", "title": "Zigzag Conversion", "difficulty": "mid"},
    {"slug": "reverse-integer", "title": "Reverse Integer", "difficulty": "entry"},
    {"slug": "longest-common-prefix", "title": "Longest Common Prefix", "difficulty": "entry"},
    {"slug": "implement-strstr", "title": "Implement strStr()", "difficulty": "entry"},
    {"slug": "substring-with-concatenation-of-all-words", "title": "Substring with Concatenation of All Words", "difficulty": "senior"},
    {"slug": "binary-subarrays-with-sum", "title": "Binary Subarrays With Sum", "difficulty": "mid"},
    {"slug": "maximum-sum-circular-subarray", "title": "Maximum Sum Circular Subarray", "difficulty": "mid"},
    {"slug": "subarray-sum-equals-k", "title": "Subarray Sum Equals K", "difficulty": "mid"},
    {"slug": "continuous-subarray-sum", "title": "Continuous Subarray Sum", "difficulty": "mid"},
    {"slug": "find-all-anagrams-in-a-string", "title": "Find All Anagrams in a String", "difficulty": "mid"},
    {"slug": "word-pattern", "title": "Word Pattern", "difficulty": "entry"},
    {"slug": "ransom-note", "title": "Ransom Note", "difficulty": "entry"},
    {"slug": "valid-number", "title": "Valid Number", "difficulty": "senior"},
    {"slug": "remove-invalid-parentheses", "title": "Remove Invalid Parentheses", "difficulty": "senior"},
    {"slug": "basic-calculator", "title": "Basic Calculator", "difficulty": "senior"},
    {"slug": "basic-calculator-ii", "title": "Basic Calculator II", "difficulty": "mid"},
    {"slug": "basic-calculator-iii", "title": "Basic Calculator III", "difficulty": "senior"},
    {"slug": "different-ways-to-add-parentheses", "title": "Different Ways to Add Parentheses", "difficulty": "mid"},
    {"slug": "n-queens", "title": "N-Queens", "difficulty": "senior"},
    {"slug": "n-queens-ii", "title": "N-Queens II", "difficulty": "senior"},
    {"slug": "sudoku-solver", "title": "Sudoku Solver", "difficulty": "senior"},
    {"slug": "spiral-matrix-ii", "title": "Spiral Matrix II", "difficulty": "mid"},
    {"slug": "set-mismatch", "title": "Set Mismatch", "difficulty": "entry"},
    {"slug": "find-all-numbers-disappeared-in-an-array", "title": "Find All Numbers Disappeared in an Array", "difficulty": "entry"},
    {"slug": "find-duplicate-subtrees", "title": "Find Duplicate Subtrees", "difficulty": "senior"},
    {"slug": "largest-sum-of-averages", "title": "Largest Sum of Averages", "difficulty": "senior"},
    {"slug": "kth-smallest-element-in-a-sorted-matrix", "title": "Kth Smallest Element in a Sorted Matrix", "difficulty": "senior"},
    {"slug": "search-a-2d-matrix-ii", "title": "Search a 2D Matrix II", "difficulty": "mid"},
    {"slug": "range-sum-of-bst", "title": "Range Sum of BST", "difficulty": "entry"},
    {"slug": "next-permutation", "title": "Next Permutation", "difficulty": "mid"},
    {"slug": "permutation-sequence", "title": "Permutation Sequence", "difficulty": "senior"},
    {"slug": "binary-watch", "title": "Binary Watch", "difficulty": "entry"},
    {"slug": "combination-sum-iii", "title": "Combination Sum III", "difficulty": "mid"},
    {"slug": "permutations-ii", "title": "Permutations II", "difficulty": "mid"},
    {"slug": "gray-code", "title": "Gray Code", "difficulty": "mid"},
    {"slug": "factorial-trailing-zeroes", "title": "Factorial Trailing Zeroes", "difficulty": "entry"},
    {"slug": "excel-sheet-column-number", "title": "Excel Sheet Column Number", "difficulty": "entry"},
    {"slug": "excel-sheet-column-title", "title": "Excel Sheet Column Title", "difficulty": "entry"},
    {"slug": "majority-element-ii", "title": "Majority Element II", "difficulty": "mid"},
    {"slug": "majority-element", "title": "Majority Element", "difficulty": "entry"},
    {"slug": "missing-ranges", "title": "Missing Ranges", "difficulty": "entry"},
    {"slug": "summary-ranges", "title": "Summary Ranges", "difficulty": "entry"},
    {"slug": "increasing-triplet-subsequence", "title": "Increasing Triplet Subsequence", "difficulty": "mid"},
    {"slug": "maximum-xor-of-two-numbers-in-an-array", "title": "Maximum XOR of Two Numbers in an Array", "difficulty": "senior"},
    {"slug": "find-minimum-in-rotated-sorted-array-ii", "title": "Find Minimum in Rotated Sorted Array II", "difficulty": "mid"},
    {"slug": "search-in-rotated-sorted-array-ii", "title": "Search in Rotated Sorted Array II", "difficulty": "mid"},
    {"slug": "minimum-size-subarray-sum", "title": "Minimum Size Subarray Sum", "difficulty": "mid"},
    {"slug": "find-peak-element", "title": "Find Peak Element", "difficulty": "entry"},
    {"slug": "wiggle-sort-ii", "title": "Wiggle Sort II", "difficulty": "senior"},
    {"slug": "wiggle-subsequence", "title": "Wiggle Subsequence", "difficulty": "mid"},
    {"slug": "longest-increasing-path-in-a-matrix", "title": "Longest Increasing Path in a Matrix", "difficulty": "senior"},
    {"slug": "maximum-length-of-pair-chain", "title": "Maximum Length of Pair Chain", "difficulty": "mid"},
    {"slug": "largest-number", "title": "Largest Number", "difficulty": "mid"},
    {"slug": "h-index", "title": "H-Index", "difficulty": "mid"},
    {"slug": "h-index-ii", "title": "H-Index II", "difficulty": "mid"},
    {"slug": "ugly-number-ii", "title": "Ugly Number II", "difficulty": "mid"},
]

LEETCODE_CURATED_PROBLEMS = NEETCODE_BASE_PROBLEMS + ADDITIONAL_LEETCODE_PROBLEMS

NEETCODE_BY_DIFFICULTY = {'entry': [], 'mid': [], 'senior': []}
LEETCODE_BY_SLUG = {}
for problem in LEETCODE_CURATED_PROBLEMS:
    NEETCODE_BY_DIFFICULTY.setdefault(problem['difficulty'], []).append(problem)
    LEETCODE_BY_SLUG[problem['slug']] = problem

if len(LEETCODE_CURATED_PROBLEMS) < 250:
    logger.warning("Curated LeetCode list shorter than expected: %s entries", len(LEETCODE_CURATED_PROBLEMS))

PROBLEM_TOPIC_KEYWORDS = {
    "tree": "trees",
    "bst": "trees",
    "graph": "graphs",
    "course": "graphs",
    "island": "graphs",
    "grid": "matrix",
    "matrix": "matrix",
    "array": "arrays",
    "subarray": "arrays",
    "list": "linked_list",
    "linked-list": "linked_list",
    "stack": "stack",
    "queue": "queue",
    "heap": "heaps",
    "interval": "intervals",
    "palindrome": "strings",
    "anagram": "strings",
    "string": "strings",
    "subsequence": "dp",
    "sequence": "dp",
    "path": "graphs",
    "sum": "math",
    "product": "math",
    "cache": "design",
    "design": "design",
    "encode": "design",
    "decode": "design",
}

ROLE_TOPIC_HINTS = {
    "is_backend": {"design", "graphs", "math", "dp", "heaps"},
    "is_frontend": {"strings", "arrays", "design", "matrix"},
    "is_data": {"matrix", "math", "dp", "graphs"},
    "is_mobile": {"strings", "arrays", "design"},
    "is_devops": {"design", "graphs", "heaps", "math"},
}

JOB_KEYWORD_TOPIC_MAP = {
    "analytics": "matrix",
    "dashboard": "matrix",
    "visualization": "matrix",
    "stream": "graphs",
    "distributed": "design",
    "microservice": "design",
    "observability": "design",
    "security": "design",
    "compliance": "design",
    "api": "design",
    "browser": "strings",
    "mobile": "strings",
    "nlp": "strings",
    "pricing": "math",
    "forecast": "math",
    "ml": "dp",
    "machine learning": "dp",
    "optimization": "dp",
    "pipeline": "graphs",
    "etl": "graphs",
}


@lru_cache(maxsize=512)
def _problem_topics(slug: str) -> set:
    slug = (slug or "").lower()
    topics = set()
    for keyword, topic in PROBLEM_TOPIC_KEYWORDS.items():
        if keyword in slug:
            topics.add(topic)
    if not topics:
        topics.add("general")
    return topics


def _job_keyword_blob(job) -> str:
    return " ".join(filter(None, [
        (getattr(job, "title", "") or "").lower(),
        (getattr(job, "company_name", "") or "").lower(),
        (getattr(job, "industry", "") or "").lower(),
        (getattr(job, "description", "") or "").lower(),
    ]))


def _target_difficulty(job) -> str:
    title = ((getattr(job, "title", "") or "").lower())
    if any(keyword in title for keyword in ["staff", "principal", "senior", "lead", "architect"]):
        return "senior"
    if any(keyword in title for keyword in ["intern", "junior", "associate"]):
        return "entry"
    return "mid"


def _desired_topics(job, context: Dict[str, bool]) -> set:
    blob = _job_keyword_blob(job)
    topics = set()
    for keyword, topic in JOB_KEYWORD_TOPIC_MAP.items():
        if keyword in blob:
            topics.add(topic)
    for ctx_key, ctx_topics in ROLE_TOPIC_HINTS.items():
        if context.get(ctx_key):
            topics.update(ctx_topics)
    if not topics:
        topics.update({"arrays", "strings", "dp"})
    return topics


def _score_problem_for_job(problem: Dict[str, Any], job, context: Dict[str, bool], desired_topics: set, target_diff: str, keyword_blob: str) -> float:
    topics = _problem_topics(problem['slug'])
    overlap = len(topics & desired_topics)
    difficulty = problem.get('difficulty', 'mid')
    score = float(overlap * 2)
    if difficulty == target_diff:
        score += 2.5
    elif target_diff == 'senior' and difficulty == 'mid':
        score += 1.0
    elif target_diff == 'mid' and difficulty == 'senior':
        score += 0.5
    if context.get('is_data') and 'matrix' in topics:
        score += 0.6
    if context.get('is_frontend') and ('strings' in topics or 'matrix' in topics):
        score += 0.4
    if context.get('is_backend') and ('design' in topics or 'graphs' in topics):
        score += 0.6
    slug_tokens = problem['slug'].replace('-', ' ')
    if any(token and token in keyword_blob for token in slug_tokens.split()):
        score += 0.3
    return score


def _select_leetcode_problems(job, context: Dict[str, bool], primary_count: int = 5, suggested_count: int = 5):
    desired_topics = _desired_topics(job, context)
    target_diff = _target_difficulty(job)
    keyword_blob = _job_keyword_blob(job)
    seed = int(_make_identifier(job.title or '', job.company_name or '', job.description or ''), 16)
    rng = random.Random(seed)
    scored = []
    for problem in LEETCODE_CURATED_PROBLEMS:
        base = _score_problem_for_job(problem, job, context, desired_topics, target_diff, keyword_blob)
        scored.append((base + rng.random() * 0.5, problem))
    scored.sort(key=lambda item: item[0], reverse=True)
    ordered = []
    seen = set()
    for _, problem in scored:
        slug = problem['slug']
        if slug in seen:
            continue
        ordered.append(problem)
        seen.add(slug)
    primary = ordered[:primary_count]
    extras_start = primary_count
    suggestions = ordered[extras_start:extras_start + suggested_count]
    tail_index = extras_start + suggested_count
    while len(primary) < primary_count and tail_index < len(ordered):
        primary.append(ordered[tail_index])
        tail_index += 1
    while len(suggestions) < suggested_count and tail_index < len(ordered):
        candidate = ordered[tail_index]
        if candidate not in primary:
            suggestions.append(candidate)
        tail_index += 1
    if len(primary) < primary_count:
        primary = ordered[:primary_count]
    if len(suggestions) < suggested_count:
        for problem in ordered:
            if problem not in primary and problem not in suggestions:
                suggestions.append(problem)
            if len(suggestions) >= suggested_count:
                break
    return primary, suggestions


def apply_leetcode_links(challenges: List[Dict[str, Any]]) -> None:
    if not challenges:
        return
    for idx, challenge in enumerate(challenges):
        slug = (challenge.get("slug") or "").strip().lower()
        reference = LEETCODE_BY_SLUG.get(slug)
        if not reference:
            difficulty = (challenge.get("difficulty") or "mid").lower()
            bucket = NEETCODE_BY_DIFFICULTY.get(difficulty) or NEETCODE_BY_DIFFICULTY['mid']
            if not bucket:
                continue
            reference = bucket[idx % len(bucket)]
            challenge.setdefault("slug", reference['slug'])
        challenge.setdefault("reference_links", [])
        url = f"https://leetcode.com/problems/{reference['slug']}/"
        title = reference.get("title") or reference["slug"].replace("-", " ").title()
        if not any(link.get("url") == url for link in challenge["reference_links"]):
            challenge["reference_links"].append({
                "label": f"LeetCode – {title}",
                "url": url,
            })


def _parse_gemini_json(content: str) -> Dict[str, Any]:
    cleaned = (content or "").strip()
    if not cleaned:
        raise ValueError("Gemini returned empty response for technical prep.")

    attempts = []

    def _add_candidate(candidate: str) -> None:
        candidate = (candidate or "").strip()
        if candidate and candidate not in attempts:
            attempts.append(candidate)

    _add_candidate(cleaned)

    closing_idx = max(cleaned.rfind('}'), cleaned.rfind(']'))
    if closing_idx >= 0 and closing_idx < len(cleaned) - 1:
        _add_candidate(cleaned[: closing_idx + 1])

    missing_braces = cleaned.count('{') - cleaned.count('}')
    if missing_braces > 0:
        _add_candidate(cleaned + ('}' * missing_braces))

    missing_brackets = cleaned.count('[') - cleaned.count(']')
    if missing_brackets > 0:
        _add_candidate(cleaned + (']' * missing_brackets))

    if cleaned.endswith(','):
        _add_candidate(cleaned.rstrip(','))

    decoder = JSONDecoder()

    for candidate in attempts:
        variants = [candidate]

        # If Gemini prefaced the JSON with narration, isolate from first JSON token.
        first_brace = candidate.find('{')
        first_bracket = candidate.find('[')
        candidates = [candidate]
        indices = [idx for idx in [first_brace, first_bracket] if idx >= 0]
        if indices:
            start_idx = min(indices)
            if start_idx > 0:
                variants.append(candidate[start_idx:])

        normalized_variants = []
        for variant in variants:
            normalized = variant.replace('“', '"').replace('”', '"').replace('’', "'")
            normalized_variants.append(normalized)

        for variant in normalized_variants:
            try:
                return json.loads(variant)
            except JSONDecodeError:
                try:
                    obj, end = decoder.raw_decode(variant)
                except JSONDecodeError:
                    pass
                else:
                    remainder = variant[end:].strip()
                    if remainder:
                        logger.debug(
                            "Discarded trailing non-JSON content from Gemini response: %s",
                            remainder[:120],
                        )
                    return obj
                trimmed = variant.rstrip(', \n\r\t')
                if trimmed != variant:
                    try:
                        return json.loads(trimmed)
                    except JSONDecodeError:
                        continue

    snippet = cleaned[:200]
    logger.error("Failed to parse Gemini technical prep JSON after repairs. Snippet: %s", snippet)
    raise ValueError("Gemini returned invalid JSON for technical prep.")


@dataclass
class StackSummary:
    languages: List[str]
    frameworks: List[str]
    tooling: List[str]


def _make_identifier(*values: str) -> str:
    """Create deterministic short identifiers from provided values."""
    seed = ":".join(filter(None, [v.strip().lower() for v in values if v]))
    if not seed:
        seed = "technical-prep"
    import hashlib

    return hashlib.sha1(seed.encode("utf-8")).hexdigest()[:16]


@lru_cache(maxsize=8)
def _get_gemini_client(api_key: str):
    if not api_key:
        raise ValueError("Gemini API key is required for technical prep generation.")
    if genai is None:
        raise ValueError("google-genai package is not installed. Please add google-genai to backend requirements.")
    return genai.Client(api_key=api_key)


def _run_with_timeout(func: Callable[[], Any], timeout_seconds: float) -> Any:
    if not timeout_seconds or timeout_seconds <= 0:
        return func()
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(func)
        try:
            return future.result(timeout=timeout_seconds)
        except concurrent.futures.TimeoutError as exc:
            future.cancel()
            raise TimeoutError("Gemini request timed out") from exc


def _infer_stack_from_job(job) -> StackSummary:
    required_skills = SkillsGapAnalyzer._extract_job_requirements(job)[:8]
    languages, frameworks, tooling = [], [], []
    language_keywords = {"python", "java", "javascript", "typescript", "go", "ruby", "c++", "sql"}
    framework_keywords = {"react", "angular", "vue", "django", "flask", "spring", "node", "next.js", "fastapi"}

    for skill in required_skills:
        name = (skill.get("name") or "").strip()
        if not name:
            continue
        lowered = name.lower()
        if lowered in language_keywords or "language" in (skill.get("category") or "").lower():
            languages.append(name)
        elif any(keyword in lowered for keyword in framework_keywords):
            frameworks.append(name)
        else:
            tooling.append(name)

    if not languages:
        languages = ["Python", "JavaScript"]
    if not frameworks:
        frameworks = ["React", "Django"]
    if not tooling:
        tooling = ["PostgreSQL", "Docker", "AWS"]

    def dedupe(values: List[str]) -> List[str]:
        seen = {}
        for value in values:
            if value not in seen:
                seen[value] = True
        return list(seen.keys())

    return StackSummary(
        languages=dedupe(languages),
        frameworks=dedupe(frameworks),
        tooling=dedupe(tooling),
    )


class TechnicalPrepGenerator:
    """Generate structured technical interview prep plans via Gemini."""

    def __init__(
        self,
        job,
        profile,
        *,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        allow_missing_api_key: bool = False,
    ):
        self.job = job
        self.profile = profile
        self.context = _derive_role_context(job)
        self.is_technical = self.context.get("is_technical", False)
        self.api_key = (
            api_key
            or os.getenv("GEMINI_API_KEY")
            or getattr(settings, "GEMINI_API_KEY", "")
        )
        self.allow_missing_api_key = allow_missing_api_key
        self.model = (
            model
            or os.getenv("GEMINI_MODEL")
            or getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")
        )
        self.required_skills = SkillsGapAnalyzer._extract_job_requirements(job)[:8]
        self.stack = _infer_stack_from_job(job)
        self.build_timeout = float(os.getenv("TECHNICAL_PREP_BUILD_TIMEOUT", "28"))
        self.deadline = time.monotonic() + self.build_timeout

        if not self.api_key and not self.allow_missing_api_key:
            raise ValueError("Gemini API key is required for technical prep generation.")

    def generate(self) -> Dict[str, Any]:
        """
        Call Gemini in smaller chunks to keep latency manageable while still covering
        all UC-078 requirements.
        """
        summary = self._summary_section()
        coding_sections = self._build_coding_sections()
        advanced = self._advanced_section()

        payload = {
            "tech_stack": summary.get("tech_stack") or {},
            "focus_areas": summary.get("focus_areas") or [],
            "coding_challenges": coding_sections.get("coding_challenges") or [],
            "suggested_challenges": coding_sections.get("suggested_challenges") or [],
            "system_design_scenarios": advanced.get("system_design_scenarios") or [],
            "case_studies": advanced.get("case_studies") or [],
            "technical_questions": advanced.get("technical_questions") or [],
            "solution_frameworks": advanced.get("solution_frameworks") or [],
            "whiteboarding_practice": advanced.get("whiteboarding_practice") or {},
            "real_world_alignment": advanced.get("real_world_alignment") or [],
        }
        if not self.is_technical:
            payload["coding_challenges"] = []
            payload["system_design_scenarios"] = []
            payload["whiteboarding_practice"] = {}
            payload["suggested_challenges"] = []
        payload["role_profile"] = "technical" if self.is_technical else "business"
        payload["source"] = "gemini"
        return self._post_process(payload)

    def generate_fallback_only(self) -> Dict[str, Any]:
        """Build a deterministic fallback plan without contacting Gemini."""
        summary = self._fallback_summary()
        primary, suggested = _select_leetcode_problems(self.job, self.context, primary_count=5, suggested_count=6)
        coding_sections = self._fallback_coding_sections(primary, suggested)
        advanced = self._fallback_advanced()
        payload = {
            "tech_stack": summary.get("tech_stack") or {},
            "focus_areas": summary.get("focus_areas") or [],
            "coding_challenges": coding_sections.get("coding_challenges") or [],
            "suggested_challenges": coding_sections.get("suggested_challenges") or [],
            "system_design_scenarios": advanced.get("system_design_scenarios") or [],
            "case_studies": advanced.get("case_studies") or [],
            "technical_questions": advanced.get("technical_questions") or [],
            "solution_frameworks": advanced.get("solution_frameworks") or [],
            "whiteboarding_practice": advanced.get("whiteboarding_practice") or {},
            "real_world_alignment": advanced.get("real_world_alignment") or [],
        }
        if not self.is_technical:
            payload["coding_challenges"] = []
            payload["system_design_scenarios"] = []
            payload["whiteboarding_practice"] = {}
            payload["suggested_challenges"] = []
        payload["role_profile"] = "technical" if self.is_technical else "business"
        payload["source"] = "fallback"
        return self._post_process(payload)

    def _context_block(self) -> str:
        job_title = (self.job.title or "Technical Candidate").strip()
        company = (self.job.company_name or "the company").strip()
        description = (self.job.description or "").strip()[:400]
        summary = (self.profile.summary or "").strip()[:240]
        skills = ", ".join(skill.get("name") for skill in self.required_skills if skill.get("name")) or "core engineering skills"
        stack_summary = f"{'/'.join(self.stack.languages[:2])} | {'/'.join(self.stack.frameworks[:2])} | {'/'.join(self.stack.tooling[:2])}"
        return (
            f"Role: {job_title} at {company}.\n"
            f"Job snippet: {description or 'None'}\n"
            f"Candidate summary: {summary or 'None'}\n"
            f"Key skills: {skills}\n"
            f"Stack focus: {stack_summary}"
        )

    def _summary_prompt(self) -> str:
        return (
            f"{self._context_block()}\n"
            "Respond only with JSON (no prose).\n"
            '{"tech_stack": {"languages": [..], "frameworks": [..], "tooling": [..]}, '
            '"focus_areas": [{"skill": "", "category": "", "recommended_hours": 0, '
            '"practice_tip": "", "relevance": "core"|"stretch"}]}'
        )

    def _summary_section(self) -> Dict[str, Any]:
        if not self.is_technical:
            return self._fallback_summary()
        try:
            return self._request_gemini(self._summary_prompt())
        except RECOVERABLE_GEMINI_ERRORS as exc:
            logger.warning("Gemini summary parse failed for job %s; falling back: %s", self.job.id, exc)
            return self._fallback_summary()

    def _advanced_section(self) -> Dict[str, Any]:
        if not self.is_technical:
            return self._fallback_advanced()
        try:
            return self._request_gemini(self._advanced_prompt())
        except RECOVERABLE_GEMINI_ERRORS as exc:
            logger.warning("Gemini advanced section parse failed for job %s; using fallback: %s", self.job.id, exc)
            return self._fallback_advanced()

    def _build_coding_sections(self) -> Dict[str, List[Dict[str, Any]]]:
        if not self.is_technical:
            return {"coding_challenges": [], "suggested_challenges": []}
        primary, suggested = _select_leetcode_problems(self.job, self.context, primary_count=5, suggested_count=6)
        prompt = self._coding_prompt(primary, suggested)
        try:
            response = self._request_gemini(prompt) or {}
        except RECOVERABLE_GEMINI_ERRORS as exc:
            logger.warning("Gemini coding section generation failed for job %s; generating fallback drills: %s", self.job.id, exc)
            return self._fallback_coding_sections(primary, suggested)
        coding = response.get("coding_challenges") or []
        suggestions = response.get("suggested_challenges") or []
        coding = self._ensure_problem_coverage(primary, coding, summarized=False)
        suggestions = self._ensure_problem_coverage(suggested, suggestions, summarized=True)
        return {
            "coding_challenges": coding,
            "suggested_challenges": suggestions,
        }

    def _coding_prompt(self, primary: List[Dict[str, Any]], suggested: List[Dict[str, Any]]) -> str:
        def _problem_lines(problems: List[Dict[str, Any]]) -> str:
            lines = []
            for item in problems:
                topics = ",".join(sorted(_problem_topics(item['slug'])))
                lines.append(
                    f"- slug:{item['slug']} | title:{item['title']} | difficulty:{item['difficulty']} | focus:{topics}"
                )
            return "\n".join(lines)

        primary_block = _problem_lines(primary)
        suggested_block = _problem_lines(suggested)
        instructions = (
            '{"coding_challenges": [{"slug": "", "title": "", "description": "", "difficulty": "", '
            '"objectives": ["..."], "best_practices": ["..."], '
            '"timer": {"recommended_minutes": 0, "benchmark": "", "stretch_goal": ""}, '
            '"evaluation_metrics": ["..."], "solution_outline": {"setup": [], "implementation": [], "testing": []}, '
            '"real_world_alignment": ""}], '
            '"suggested_challenges": [{"slug": "", "title": "", "difficulty": "", "description": "", '
            '"timer": {"recommended_minutes": 0}, "practice_focus": "", "key_metric": ""}]}'
        )
        return "\n".join([
            f"{self._context_block()}",
            "Use only these problems. Return JSON only.",
            f"Primary:\n{primary_block}",
            f"Suggested:\n{suggested_block}",
            instructions,
        ])

    def _single_problem_prompt(self, problem: Dict[str, Any], *, summarized: bool = False) -> str:
        topics = ",".join(sorted(_problem_topics(problem['slug'])))
        base = (
            f"{self._context_block()}\n"
            "Problem detail:\n"
            f"- slug:{problem['slug']} | title:{problem['title']} | difficulty:{problem['difficulty']} | focus:{topics}\n"
        )
        if summarized:
            instructions = (
                '{"suggested_challenges": [{"slug": slug, "title": title, "difficulty": difficulty, '
                '"description": "", "timer": {"recommended_minutes": 0}, "practice_focus": "", "key_metric": ""}]}'
            )
        else:
            instructions = (
                '{"coding_challenges": [{"slug": slug, "title": title, "description": "", "difficulty": difficulty, '
                '"objectives": ["..."], "best_practices": ["..."], '
                '"timer": {"recommended_minutes": 0, "benchmark": "", "stretch_goal": ""}, '
                '"evaluation_metrics": ["..."], "solution_outline": {"setup": [], "implementation": [], "testing": []}, '
                '"real_world_alignment": ""}]}'
            )
        return base + "Respond only with JSON: " + instructions

    def _ensure_problem_coverage(self, expected: List[Dict[str, Any]], entries: List[Dict[str, Any]], *, summarized: bool) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        seen = set()
        for entry in entries or []:
            slug = (entry.get("slug") or entry.get("problem_slug") or "").strip().lower()
            if not slug or slug in seen:
                continue
            entry["slug"] = slug
            normalized.append(entry)
            seen.add(slug)
        missing = [problem for problem in expected if problem['slug'] not in seen]
        key = 'suggested_challenges' if summarized else 'coding_challenges'
        for problem in list(missing):
            try:
                fallback = self._request_gemini(self._single_problem_prompt(problem, summarized=summarized))
            except Exception as exc:
                logger.warning("Gemini fallback failed for %s: %s", problem['slug'], exc)
                continue
            generated = fallback.get(key) or []
            appended = False
            for entry in generated:
                slug = (entry.get('slug') or problem['slug']).strip().lower()
                if not slug or slug in seen:
                    continue
                entry['slug'] = slug
                normalized.append(entry)
                seen.add(slug)
                appended = True
                break
            if appended:
                missing = [problem for problem in expected if problem['slug'] not in seen]

        if missing:
            for problem in missing:
                if summarized:
                    fallback_entry = self._fallback_suggested_entry(problem, len(normalized))
                else:
                    fallback_entry = self._fallback_coding_entry(problem, len(normalized))
                fallback_entry['slug'] = problem['slug']
                normalized.append(fallback_entry)
                seen.add(problem['slug'])
        return normalized

    def _advanced_prompt(self) -> str:
        base = (
            f"{self._context_block()}\n"
            "Respond only with JSON. Include keys: system_design_scenarios, case_studies, technical_questions, solution_frameworks, whiteboarding_practice, real_world_alignment."
            " Provide at least two entries for scenarios, case_studies, and technical_questions. Keep sentences short and role-specific."
        )
        if not self.is_technical:
            return (
                f"{self._context_block()}\n"
                "Respond only with JSON: {\"case_studies\": [...], \"technical_questions\": [...], \"solution_frameworks\": [...], \"real_world_alignment\": [...]}"
                " Focus on business scenarios. Do not include coding or system design content."
            )
        return base

    def _request_gemini(self, prompt: str) -> Dict[str, Any]:
        prompt_text = (prompt or "").strip()
        if not prompt_text:
            raise ValueError("Gemini prompt cannot be empty.")

        remaining_budget = self.deadline - time.monotonic()
        if remaining_budget <= 0:
            raise TimeoutError("Technical prep generation exceeded time budget")

        client = _get_gemini_client(self.api_key)
        generation_config = genai.types.GenerateContentConfig(
            temperature=0.25,
            top_p=0.9,
            top_k=40,
            max_output_tokens=4096,
        )

        timeout_seconds = float(os.getenv("GEMINI_REQUEST_TIMEOUT", "15"))
        timeout_seconds = min(timeout_seconds, max(1.0, remaining_budget))

        try:
            logger.info(
                "Requesting Gemini technical prep section (job %s)",
                self.job.id,
            )
            def _perform_call():
                return client.models.generate_content(
                    model=self.model,
                    contents=prompt_text,
                    config=generation_config,
                )

            response = _run_with_timeout(_perform_call, timeout_seconds)
        except google_exceptions.DeadlineExceeded as exc:
            logger.warning("Gemini request timed out for job %s", self.job.id)
            raise TimeoutError("Gemini request timed out") from exc
        except TimeoutError:
            logger.warning("Gemini request exceeded %s seconds for job %s", timeout_seconds, self.job.id)
            raise
        except google_exceptions.GoogleAPIError as exc:
            logger.error("Gemini technical prep request failed: %s", exc)
            raise

        content = getattr(response, "text", None) or getattr(response, "output_text", None)
        if not content:
            candidates = getattr(response, "candidates", None) or []
            if candidates:
                try:
                    first_part = candidates[0].content.parts[0]
                    content = getattr(first_part, "text", "") or str(first_part)
                except (IndexError, AttributeError, TypeError):
                    content = ""

        content = (content or "").strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        if not content:
            raise ValueError("Gemini response missing content")

        return _parse_gemini_json(content)


    def _post_process(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        data = payload or {}
        data["has_data"] = True
        data["job_title"] = self.job.title or ""
        data["company_name"] = self.job.company_name or ""
        data.setdefault("tech_stack", self.stack.__dict__)
        data.setdefault("focus_areas", self._fallback_focus_areas())

        for key in [
            "coding_challenges",
            "suggested_challenges",
            "system_design_scenarios",
            "case_studies",
            "technical_questions",
            "solution_frameworks",
            "real_world_alignment",
        ]:
            section = data.get(key)
            if not isinstance(section, list):
                data[key] = []

        whiteboarding = data.get("whiteboarding_practice")
        if not isinstance(whiteboarding, dict):
            data["whiteboarding_practice"] = {}

        self._assign_ids(data)
        apply_leetcode_links(data.get("coding_challenges", []))
        apply_leetcode_links(data.get("suggested_challenges", []))
        return data

    def _fallback_focus_areas(self) -> List[Dict[str, Any]]:
        focus = []
        for idx, skill in enumerate(self.required_skills[:4]):
            name = skill.get("name")
            if not name:
                continue
            focus.append(
                {
                    "skill": name,
                    "category": skill.get("category") or "Technical",
                    "recommended_hours": 6 + idx * 2,
                    "practice_tip": f"Connect {name} stories to measurable impact during interviews.",
                    "relevance": skill.get("importance", "core"),
                }
            )
        if not focus:
            focus.append(
                {
                    "skill": "Problem Solving",
                    "category": "Technical",
                    "recommended_hours": 8,
                    "practice_tip": "Translate ambiguous prompts into a deterministic plan before coding.",
                    "relevance": "core",
                }
            )
        return focus

    def _assign_ids(self, data: Dict[str, Any]) -> None:
        focus_areas = data.get("focus_areas", []) or []
        for idx, focus in enumerate(focus_areas):
            if not isinstance(focus, dict):
                focus = {"skill": str(focus)}
                focus_areas[idx] = focus
            focus["id"] = focus.get("id") or _make_identifier("focus-area", focus.get("skill"), str(idx))
        coding_challenges = data.get("coding_challenges", []) or []
        for idx, challenge in enumerate(coding_challenges):
            if not isinstance(challenge, dict):
                challenge = {"title": str(challenge)}
                coding_challenges[idx] = challenge
            challenge["id"] = challenge.get("id") or _make_identifier("coding", challenge.get("title"), str(idx))
            challenge["timed"] = challenge.get("timed", True)
        suggested_challenges = data.get("suggested_challenges", []) or []
        for idx, suggestion in enumerate(suggested_challenges):
            if not isinstance(suggestion, dict):
                suggestion = {"title": str(suggestion)}
                suggested_challenges[idx] = suggestion
            suggestion["id"] = suggestion.get("id") or _make_identifier("suggested", suggestion.get("title"), str(idx))
            suggestion["timed"] = suggestion.get("timed", False)
        system_design = data.get("system_design_scenarios", []) or []
        for idx, scenario in enumerate(system_design):
            if not isinstance(scenario, dict):
                scenario = {"title": str(scenario)}
                system_design[idx] = scenario
            scenario["id"] = scenario.get("id") or _make_identifier("system-design", scenario.get("title"), str(idx))
        case_studies = data.get("case_studies", []) or []
        for idx, study in enumerate(case_studies):
            if not isinstance(study, dict):
                study = {"title": str(study)}
                case_studies[idx] = study
            study["id"] = study.get("id") or _make_identifier("case-study", study.get("title"), str(idx))
        technical_questions = data.get("technical_questions", []) or []
        for idx, question in enumerate(technical_questions):
            if not isinstance(question, dict):
                question = {"prompt": str(question)}
                technical_questions[idx] = question
            question["id"] = question.get("id") or _make_identifier("technical-question", question.get("prompt"), str(idx))
        alignment_items = data.get("real_world_alignment", []) or []
        for idx, item in enumerate(alignment_items):
            if not isinstance(item, dict):
                item = {"skill": str(item)}
                alignment_items[idx] = item
            item["id"] = item.get("id") or _make_identifier("real-world", item.get("skill"), str(idx))

    def _fallback_summary(self) -> Dict[str, Any]:
        return {
            "tech_stack": {
                "languages": self.stack.languages,
                "frameworks": self.stack.frameworks,
                "tooling": self.stack.tooling,
            },
            "focus_areas": self._fallback_focus_areas(),
        }

    def _fallback_coding_sections(self, primary: List[Dict[str, Any]], suggested: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        return {
            "coding_challenges": [self._fallback_coding_entry(problem, idx) for idx, problem in enumerate(primary)],
            "suggested_challenges": [self._fallback_suggested_entry(problem, idx) for idx, problem in enumerate(suggested)],
        }

    def _fallback_coding_entry(self, problem: Dict[str, Any], idx: int) -> Dict[str, Any]:
        slug = problem.get("slug") or f"fallback-problem-{idx}"
        difficulty = (problem.get("difficulty") or "mid").lower()
        focus_topics = ", ".join(sorted(_problem_topics(slug)))
        company = self.job.company_name or "the company"
        recommended_minutes = {
            "entry": 25,
            "mid": 35,
            "senior": 45,
        }.get(difficulty, 30)
        return {
            "slug": slug,
            "title": problem.get("title") or "Coding Drill",
            "description": f"Rehearse {problem.get('title') or slug} to reinforce {focus_topics} thinking for {company}.",
            "difficulty": difficulty,
            "objectives": [
                f"Translate requirements into {focus_topics} steps.",
                "Narrate tradeoffs aloud to simulate the interview.",
            ],
            "best_practices": [
                "Lead with clarifying questions.",
                "Tie solution choices to reliability or customer impact.",
            ],
            "timer": {
                "recommended_minutes": recommended_minutes,
                "benchmark": "Ship a working solution with tests.",
                "stretch_goal": "Discuss optimizations and monitoring.",
            },
            "evaluation_metrics": [
                "Correctness",
                "Time complexity justification",
                "Communication clarity",
            ],
            "solution_outline": {
                "setup": ["Confirm constraints", "Sketch data structures"],
                "implementation": ["Code iteratively", "Validate edge cases"],
                "testing": ["Walk through sample inputs", "State failure monitoring"],
            },
            "real_world_alignment": f"Maps directly to {company}'s interview focus on resilient services.",
        }

    def _fallback_suggested_entry(self, problem: Dict[str, Any], idx: int) -> Dict[str, Any]:
        slug = problem.get("slug") or f"fallback-suggestion-{idx}"
        difficulty = (problem.get("difficulty") or "mid").lower()
        topics = ", ".join(sorted(_problem_topics(slug)))
        return {
            "slug": slug,
            "title": problem.get("title") or "Suggested Drill",
            "description": f"Quick warm-up covering {topics}.",
            "difficulty": difficulty,
            "timer": {"recommended_minutes": 15 if difficulty == "entry" else 25},
            "practice_focus": f"Explain why {topics} techniques fit the prompt.",
            "key_metric": "Confidence narrating approach under time pressure",
        }

    def _fallback_advanced(self) -> Dict[str, Any]:
        company = self.job.company_name or "the company"
        title = self.job.title or "the role"
        if not self.is_technical:
            return {
                "system_design_scenarios": [],
                "case_studies": [
                    {
                        "title": "Executive Readout",
                        "role_focus": title,
                        "scenario": f"Prepare a briefing that keeps {company} leadership aligned.",
                        "tasks": ["Summarize insights", "Recommend next actions", "Define success metrics"],
                    },
                    {
                        "title": "Stakeholder Alignment",
                        "role_focus": title,
                        "scenario": "Address conflicting priorities ahead of interviews.",
                        "tasks": ["Map stakeholders", "Surface tradeoffs", "Gain buy-in"],
                    },
                ],
                "technical_questions": [
                    {
                        "prompt": "Walk through a recent initiative start-to-finish.",
                        "linked_skill": "Storytelling",
                        "answer_framework": ["Context", "Action", "Impact"],
                    },
                    {
                        "prompt": "Describe how you influence cross-functional partners.",
                        "linked_skill": "Leadership",
                        "answer_framework": ["Stakeholder map", "Approach", "Result"],
                    },
                ],
                "solution_frameworks": [
                    {"name": "PACE", "steps": ["Problem", "Alternatives", "Choice", "Execution"]},
                    {"name": "STAR+", "steps": ["Situation", "Task", "Action", "Result", "Lessons"]},
                ],
                "whiteboarding_practice": {},
                "real_world_alignment": [
                    {
                        "skill": "Executive Communication",
                        "scenario": f"Link decisions back to {company}'s KPIs.",
                        "business_link": "Demonstrates alignment with leadership priorities.",
                    },
                    {
                        "skill": "Structured Thinking",
                        "scenario": "Decompose ambiguous prompts before brainstorming.",
                        "business_link": "Keeps interviews focused on measurable impact.",
                    },
                ],
            }

        return {
            "system_design_scenarios": [
                {
                    "title": f"Scale {company} core services",
                    "scenario": f"Design an architecture that keeps {company}'s flagship experience fast for new regions.",
                    "requirements": ["Regional failover", "Real-time monitoring", "API compatibility"],
                    "constraints": ["Budget guardrails", "Aggressive SLAs"],
                    "evaluation": ["Tradeoff narration", "Bottleneck mitigation"],
                },
                {
                    "title": "Insights Streaming Platform",
                    "scenario": "Build a pipeline turning product telemetry into actionable dashboards.",
                    "requirements": ["Exactly-once delivery", "Schema evolution"],
                    "constraints": ["Mixed cloud providers"],
                    "evaluation": ["Data contracts", "Backfill strategy"],
                },
            ],
            "case_studies": [
                {
                    "title": "Incident Postmortem",
                    "role_focus": title,
                    "scenario": "Share how you would lead a blameless retro after an outage.",
                    "tasks": ["Stabilize systems", "Extract learnings", "Close follow-ups"],
                },
                {
                    "title": "Migration Blueprint",
                    "role_focus": title,
                    "scenario": f"Plan a phased rewrite that avoids downtime for {company}.",
                    "tasks": ["Define phases", "Quantify risk", "Map owners"],
                },
            ],
            "technical_questions": [
                {
                    "prompt": "Describe how you debug systemic latency spikes.",
                    "linked_skill": "Reliability",
                    "answer_framework": ["Signal gathering", "Isolation", "Remediation"],
                },
                {
                    "prompt": "Explain your approach to mentoring engineers during system design rounds.",
                    "linked_skill": "Leadership",
                    "answer_framework": ["Set context", "Guide decisions", "Measure outcomes"],
                },
            ],
            "solution_frameworks": [
                {"name": "TRACE", "steps": ["Trigger", "Requirements", "Architecture", "Checks", "Evolution"]},
                {"name": "DRIVE", "steps": ["Define", "Research", "Implement", "Validate", "Evolve"]},
            ],
            "whiteboarding_practice": {
                "techniques": [
                    "State assumptions and constraints first.",
                    "Narrate data flow before coding.",
                ],
                "drills": [
                    {"name": "API Contract Sprint", "duration_minutes": 12, "steps": ["Define resources", "Map error paths"]},
                    {"name": "Service Dependency Walkthrough", "duration_minutes": 8, "steps": ["List dependencies", "Mark failure modes"]},
                ],
                "evaluation_rubric": [
                    "Problem framing",
                    "Tradeoff discussion",
                    "Clarity of diagrams",
                ],
                "timed_exercises": [
                    {"name": "Five Minute Architecture", "goal": "Explain MVP diagram and scaling levers"},
                ],
            },
            "real_world_alignment": [
                {
                    "skill": "Observability",
                    "scenario": "Propose dashboards that tie reliability to user impact.",
                    "business_link": "Shows readiness to defend SLAs for executives.",
                },
                {
                    "skill": "Platform Strategy",
                    "scenario": f"Translate {company}'s roadmap into system requirements.",
                    "business_link": "Connects engineering depth to product outcomes.",
                },
            ],
        }



def build_technical_prep(job, profile, *, api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
    """Convenience wrapper used by the view layer."""
    generator = TechnicalPrepGenerator(job, profile, api_key=api_key, model=model)
    return generator.generate()


def build_technical_prep_fallback(job, profile) -> Dict[str, Any]:
    """Deterministic fallback builder for when Gemini output is pending."""
    generator = TechnicalPrepGenerator(
        job,
        profile,
        api_key=os.getenv("GEMINI_API_KEY") or getattr(settings, "GEMINI_API_KEY", ""),
        model=os.getenv("GEMINI_MODEL") or getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash"),
        allow_missing_api_key=True,
    )
    return generator.generate_fallback_only()


def _derive_role_context(job) -> Dict[str, bool]:
    title_parts = [
        getattr(job, "title", ""),
        getattr(job, "department", ""),
        getattr(job, "role_type", ""),
        getattr(job, "role_title", ""),
    ]
    title_blob = " ".join(part.strip() for part in title_parts if part).lower()
    description_blob = (getattr(job, "description", "") or "").lower()
    combined_blob = f"{title_blob}\n{description_blob}".strip()
    normalized_for_words = combined_blob.replace('-', ' ').replace('/', ' ')
    word_tokens = {
        token for token in re.split(r'[^a-z0-9+#]+', normalized_for_words) if token
    }

    def has_any(tokens):
        if not combined_blob:
            return False
        for token in tokens:
            candidate = (token or '').strip().lower()
            if not candidate:
                continue
            variants = {candidate}
            if '-' in candidate:
                variants.add(candidate.replace('-', ' '))
                variants.add(candidate.replace('-', ''))
            if '/' in candidate:
                variants.add(candidate.replace('/', ' '))
                variants.add(candidate.replace('/', ''))
            matched = False
            for variant in variants:
                if not variant:
                    continue
                if ' ' in variant:
                    if variant in combined_blob:
                        matched = True
                        break
                    continue
                if len(variant) <= 3:
                    if variant in word_tokens:
                        matched = True
                        break
                else:
                    if variant in word_tokens or variant in combined_blob:
                        matched = True
                        break
            if matched:
                return True
        return False

    backend_tokens = {"backend", "back-end", "api", "infrastructure", "microservice", "microservices", "distributed"}
    frontend_tokens = {"frontend", "front-end", "ui", "ux", "web developer", "web development", "javascript", "react", "angular", "vue", "client-side"}
    data_tokens = {"data engineer", "data platform", "data pipeline", "analytics engineer", "machine learning", "ml engineer", "ml scientist", "ai engineer", "ai scientist", "big data", "etl", "spark", "hadoop"}
    mobile_tokens = {"ios", "android", "mobile", "swift", "kotlin", "react native", "flutter"}
    devops_tokens = {"devops", "sre", "site reliability", "reliability engineer", "infrastructure", "kubernetes", "terraform", "ci/cd", "platform engineer", "observability"}
    security_tokens = {"security engineer", "application security", "appsec", "infosec", "cybersecurity", "penetration tester", "red team", "blue team", "security analyst"}

    engineering_title_tokens = {
        "software engineer",
        "software developer",
        "platform engineer",
        "backend engineer",
        "front end engineer",
        "frontend engineer",
        "full stack",
        "full-stack",
        "fullstack",
        "developer",
        "programmer",
        "coder",
        "devops engineer",
        "sre",
        "site reliability",
        "systems engineer",
        "technical lead",
        "tech lead",
        "architect",
        "solutions architect",
        "cloud engineer",
        "data engineer",
        "data scientist",
        "machine learning engineer",
        "ml engineer",
        "ml scientist",
        "ai engineer",
        "security engineer",
        "qa engineer",
        "sdet",
        "android engineer",
        "ios engineer",
        "mobile engineer",
        "firmware engineer",
        "embedded engineer",
        "technical product manager",
        "technical program manager",
        "technical project manager",
        "solutions engineer",
        "sales engineer",
        "forward deployed engineer",
    }

    non_technical_title_tokens = {
        "program manager",
        "project manager",
        "product manager",
        "business analyst",
        "marketing manager",
        "marketing analyst",
        "sales manager",
        "sales analyst",
        "operations manager",
        "operations analyst",
        "customer success",
        "account manager",
        "customer support",
        "talent acquisition",
        "human resources",
        "people operations",
        "recruiter",
        "scrum master",
        "agile coach",
        "product owner",
    }

    language_tokens = {
        "python",
        "java",
        "javascript",
        "typescript",
        "go",
        "golang",
        "ruby",
        "php",
        "c++",
        "c#",
        "rust",
        "scala",
        "kotlin",
        "swift",
        "react",
        "angular",
        "vue",
        "node.js",
        "nodejs",
        "django",
        "flask",
        "spring",
        "graphql",
        "rest api",
        "restful",
        "sql",
        "postgres",
        "mysql",
        "mongodb",
        "redis",
        "kafka",
        "spark",
        "hadoop",
        "docker",
        "kubernetes",
        "terraform",
        "aws",
        "azure",
        "gcp",
        "cloudformation",
    }

    build_tokens = {
        "build",
        "building",
        "software development",
        "application development",
        "system design",
        "api design",
        "implement",
        "implementing",
        "architect",
        "architecture",
        "code",
        "coding",
        "program",
        "programming",
        "debug",
        "debugging",
        "deploy",
        "deployment",
        "performance optimization",
        "scale systems",
        "automate",
        "automation",
        "microservice",
        "microservices",
        "api",
        "apis",
        "pipeline",
        "pipelines",
        "git",
        "version control",
    }

    non_technical_signal = has_any(non_technical_title_tokens)

    context = {
        "is_backend": has_any(backend_tokens),
        "is_frontend": has_any(frontend_tokens),
        "is_data": has_any(data_tokens),
        "is_mobile": has_any(mobile_tokens),
        "is_devops": has_any(devops_tokens),
        "is_security": has_any(security_tokens),
    }

    title_signal = has_any(engineering_title_tokens)
    language_signal = has_any(language_tokens)
    build_signal = has_any(build_tokens)

    context["is_technical_title"] = title_signal
    context["is_technical_description"] = language_signal and build_signal
    functional_signals = any(
        context[key]
        for key in ("is_backend", "is_frontend", "is_data", "is_mobile", "is_devops", "is_security")
    )
    context["is_technical"] = bool(
        title_signal or context["is_technical_description"] or functional_signals
    )

    context["non_technical_title"] = non_technical_signal
    # If we have a strong non-technical signal from the title, override weak technical signals
    # We only keep it technical if there is a strong technical title signal (e.g. "Technical Lead")
    # or explicit technical description (language + build keywords). Functional signals (domain keywords)
    # are not enough to override a specific non-technical title.
    if non_technical_signal and not title_signal and not context["is_technical_description"]:
        context["is_technical_title"] = False
        context["is_technical_description"] = False
        context["is_technical"] = False
    return context
