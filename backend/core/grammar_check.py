"""
Grammar and spell checking using LanguageTool.
UC-060: Cover Letter Editing and Refinement
"""
import language_tool_python
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

# Global tool instance (initialized once)
_tool = None


def get_language_tool():
    """Get or create LanguageTool instance."""
    global _tool
    if _tool is None:
        try:
            # Initialize LanguageTool with English (US)
            _tool = language_tool_python.LanguageTool('en-US')
            logger.info("LanguageTool initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize LanguageTool: {e}")
            raise
    return _tool


def check_grammar(text: str) -> List[Dict[str, Any]]:
    """
    Check text for grammar, spelling, and style issues.
    
    Args:
        text: The text to check
        
    Returns:
        List of issues with details and suggestions
    """
    if not text or not text.strip():
        return []
    
    try:
        tool = get_language_tool()
        matches = tool.check(text)
        
        issues = []
        for match in matches:
            # Map LanguageTool categories to our types
            issue_type = _map_issue_type(match.ruleIssueType)
            
            # Get the best replacement suggestion
            replacements = match.replacements[:3] if match.replacements else []
            
            issue = {
                'id': f"{match.ruleId}_{match.offset}",
                'rule_id': match.ruleId,
                'message': match.message,
                'context': match.context,
                'offset': match.offset,
                'length': match.errorLength,
                'text': text[match.offset:match.offset + match.errorLength],
                'type': issue_type,
                'category': match.category,
                'replacements': replacements,
                'can_auto_fix': len(replacements) > 0,
            }
            issues.append(issue)
        
        logger.info(f"Checked text ({len(text)} chars), found {len(issues)} issues")
        return issues
        
    except Exception as e:
        logger.error(f"Error checking grammar: {e}")
        return []


def apply_suggestion(text: str, issue: Dict[str, Any], replacement_index: int = 0) -> str:
    """
    Apply a suggestion to fix an issue.
    
    Args:
        text: Original text
        issue: Issue dict from check_grammar
        replacement_index: Which replacement to use (default: 0 = best suggestion)
        
    Returns:
        Text with the fix applied
    """
    if not issue.get('replacements'):
        return text
    
    try:
        offset = issue['offset']
        length = issue['length']
        replacement = issue['replacements'][replacement_index]
        
        fixed_text = text[:offset] + replacement + text[offset + length:]
        return fixed_text
        
    except (IndexError, KeyError) as e:
        logger.error(f"Error applying suggestion: {e}")
        return text


def _map_issue_type(rule_issue_type: str) -> str:
    """Map LanguageTool issue types to our categories."""
    type_mapping = {
        'misspelling': 'spelling',
        'grammar': 'grammar',
        'typographical': 'punctuation',
        'style': 'style',
        'uncategorized': 'other',
    }
    
    if not rule_issue_type:
        return 'other'
    
    rule_issue_type = rule_issue_type.lower()
    
    for key, value in type_mapping.items():
        if key in rule_issue_type:
            return value
    
    return 'other'


def close_language_tool():
    """Close the LanguageTool instance (call on shutdown)."""
    global _tool
    if _tool is not None:
        try:
            _tool.close()
            _tool = None
            logger.info("LanguageTool closed")
        except Exception as e:
            logger.error(f"Error closing LanguageTool: {e}")
