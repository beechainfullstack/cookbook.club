import dictionary from '../../copy.json' with { type: 'json' };

export const copy = {
  ...dictionary,
  flavors: {
    art: { label: dictionary.flavors.flavor_1, description: dictionary.flavor_descriptions.art },
    sports: { label: dictionary.flavors.flavor_2, description: dictionary.flavor_descriptions.sports },
    ideas: { label: dictionary.flavors.flavor_3, description: dictionary.flavor_descriptions.ideas },
    style: { label: dictionary.flavors.flavor_4, description: dictionary.flavor_descriptions.style },
    kindness: { label: dictionary.flavors.flavor_5, description: dictionary.flavor_descriptions.kindness },
    music: { label: dictionary.flavors.flavor_6, description: dictionary.flavor_descriptions.music },
  },
};

export function format(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) => {
    const value = values[key];
    return value === undefined ? token : String(value);
  });
}

export function joinNames(names: string[]): string {
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(copy.common.nameSeparator)} ${copy.common.and} ${names[names.length - 1]}`;
}

export function entryText(entry: {
  tagged_name: string; flavor: keyof typeof copy.flavors; revealed: boolean; tagger_names: string[];
}): string {
  const template = entry.revealed && entry.tagger_names.length >= 3
    ? copy.the_book.revealed_text_multiple : copy.the_book.unrevealed_text;
  return format(template, {
    tagged_name: entry.tagged_name,
    flavor: copy.flavors[entry.flavor].label,
    tagger_1: entry.tagger_names[0] ?? '',
    tagger_2: entry.tagger_names[1] ?? '',
    tagger_3: entry.tagger_names[2] ?? '',
  });
}

export function revealNotification(flavor: keyof typeof copy.flavors) {
  return {
    title: copy.notifications.reveal_title,
    body: format(copy.notifications.reveal_body, { flavor: copy.flavors[flavor].label }),
  };
}
