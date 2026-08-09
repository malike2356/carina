import unittest
from unittest.mock import patch

import pandas as pd

import processor


class ProcessorTests(unittest.TestCase):
    def test_prompts_are_available_for_every_classifier(self):
        for sheet_type in ('generic', 'leads', 'tenant_list', 'property_data'):
            self.assertIn('Fill only blank cells', processor._load_prompt(sheet_type))

    def test_apply_fills_never_overwrites_existing_values(self):
        frame = pd.DataFrame({'Email': [None, 'known@example.com']})
        fills = {'rows': {
            '0': {'Email': 'new@example.com'},
            '1': {'Email': 'overwrite@example.com'},
        }}

        output, count = processor._apply_fills(frame, fills)

        self.assertEqual(output.loc[0, 'Email'], 'new@example.com')
        self.assertEqual(output.loc[1, 'Email'], 'known@example.com')
        self.assertEqual(count, 1)

    @patch('processor._call_deepseek')
    def test_batches_use_relative_indexes(self, call):
        frame = pd.DataFrame({'Value': [None] * 21})
        call.side_effect = [
            {'rows': {'0': {'Value': 'first'}}},
            {'rows': {'0': {'Value': 'last'}}},
        ]

        fills = processor._enrich_batch(frame, 'generic', '')

        self.assertEqual(fills['rows']['0']['Value'], 'first')
        self.assertEqual(fills['rows']['20']['Value'], 'last')


if __name__ == '__main__':
    unittest.main()
