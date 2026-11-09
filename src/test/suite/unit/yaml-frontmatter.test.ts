import * as assert from 'assert';
import {
  joinYamlFrontmatter,
  splitYamlFrontmatter,
} from '../../../utils/yaml-frontmatter';

suite('yaml-frontmatter', () => {
  test('splitYamlFrontmatter extracts leading fence and body', () => {
    const md = '---\nname: skill\n---\n\n# Title\n';
    const { frontmatterBody, body } = splitYamlFrontmatter(md);
    assert.strictEqual(frontmatterBody, 'name: skill');
    assert.strictEqual(body, '# Title\n');
  });

  test('joinYamlFrontmatter round-trips with split', () => {
    const md = '---\nname: a\ndescription: |\n  line1\n  line2\n---\n\nBody\n';
    const split = splitYamlFrontmatter(md);
    assert.ok(split.frontmatterBody);
    const joined = joinYamlFrontmatter(split.frontmatterBody!, split.body);
    assert.strictEqual(splitYamlFrontmatter(joined).frontmatterBody, split.frontmatterBody);
    assert.strictEqual(splitYamlFrontmatter(joined).body, split.body);
  });

  test('splitYamlFrontmatter returns null when no leading fence', () => {
    const md = '# No front matter\n';
    const { frontmatterBody, body } = splitYamlFrontmatter(md);
    assert.strictEqual(frontmatterBody, null);
    assert.strictEqual(body, md);
  });
});
