from pathlib import Path
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "ddnet")

def replace_once(relative_path: str, old: str, new: str, label: str) -> None:
    path = ROOT / relative_path
    source = path.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match in {relative_path}, found {count}")
    source = source.replace(old, new, 1)
    with path.open("w", encoding="utf-8", newline="\n") as file:
        file.write(source)

# Configuration: all custom settings are added in one deterministic location.
replace_once(
    "src/engine/shared/config_variables.h",
    'MACRO_CONFIG_INT(ClDummyCopyMoves, cl_dummy_copy_moves, 0, 0, 1, CFGFLAG_CLIENT | CFGFLAG_INSENSITIVE, "Whether dummy should copy your moves")',
    '''MACRO_CONFIG_INT(ClDummyCopyMoves, cl_dummy_copy_moves, 0, 0, 1, CFGFLAG_CLIENT | CFGFLAG_INSENSITIVE, "Whether dummy should copy your moves")
MACRO_CONFIG_INT(ClDummyHammerOnW, cl_dummy_hammer_on_w, 1, 0, 1, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Whether dummy hammers while holding W")
MACRO_CONFIG_INT(ClDummyHammerWSpeed, cl_dummy_hammer_w_speed, 10, 1, 25, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Dummy hammer attempt speed while holding W")
MACRO_CONFIG_INT(ClPixelWalk, cl_pixelwalk, 1, 0, 1, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Enable PixelWalk while the +pixelwalk bind is held")
MACRO_CONFIG_INT(ClPixelWalkSpeed, cl_pixelwalk_speed, 5, 1, 10, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "PixelWalk movement speed")
MACRO_CONFIG_INT(ClAvoidFreeze, cl_avoid_freeze, 0, 0, 1, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Avoid moving into nearby freeze tiles")
MACRO_CONFIG_INT(ClAvoidFreezeRange, cl_avoid_freeze_range, 4, 1, 8, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Avoid Freeze detection range in tiles")''',
    "configuration variables",
)

# W-triggered dummy hammer. The physical W key is read without replacing the user's W bind.
replace_once(
    "src/game/client/gameclient.cpp",
    'if(!g_Config.m_ClDummyHammer)\n\t{',
    '''const bool DummyHammerOnW = g_Config.m_ClDummyHammerOnW &&
		Input()->KeyIsPressed(KEY_W) &&
		Client()->State() == IClient::STATE_ONLINE &&
		!m_Menus.IsActive() && !m_Chat.IsActive() && !m_GameConsole.IsActive() &&
		!m_Motd.IsActive() && !m_KeyBinder.IsActive();
	const bool UseDummyHammer = g_Config.m_ClDummyHammer || DummyHammerOnW;

	if(!UseDummyHammer)
	{''',
    "W hammer input",
)
replace_once(
    "src/game/client/gameclient.cpp",
    "if(m_DummyFire % 25 != 0)",
    '''const unsigned int HammerInterval = DummyHammerOnW ?
			(unsigned int)(26 - g_Config.m_ClDummyHammerWSpeed) : 25U;
		if(m_DummyFire % HammerInterval != 0)''',
    "W hammer speed",
)

# PixelWalk state and key-held command.
replace_once(
    "src/game/client/components/controls.h",
    "\tint m_aShowHookColl[NUM_DUMMIES];",
    "\tint m_aShowHookColl[NUM_DUMMIES];\n\tint m_aPixelWalk[NUM_DUMMIES];\n\tint m_aAvoidFreezeOverride[NUM_DUMMIES];\n\tint m_PixelWalkTick;",
    "PixelWalk controls state",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "#include <game/localization.h>\n",
    "#include <game/localization.h>\n#include <game/mapitems.h>\n",
    "map tile definitions include",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "#include <algorithm>\n",
    '''#include <algorithm>

static bool IsAvoidFreezeTile(int Tile)
{
	return Tile == TILE_FREEZE || Tile == TILE_DFREEZE || Tile == TILE_LFREEZE;
}

static bool IsAvoidFreezeAt(const CCollision &Collision, vec2 Pos)
{
	const int MapIndex = Collision.GetPureMapIndex(Pos);
	if(IsAvoidFreezeTile(Collision.GetTileIndex(MapIndex)) ||
		IsAvoidFreezeTile(Collision.GetFrontTileIndex(MapIndex)))
		return true;

	CDoorTile DoorTile;
	Collision.GetDoorTile(MapIndex, &DoorTile);
	return IsAvoidFreezeTile(DoorTile.m_Index);
}

static bool IsAvoidFreezeAhead(const CCollision &Collision, vec2 Pos, int Direction, int MaxDistance)
{
	for(int Distance = 20; Distance <= MaxDistance; Distance += 8)
	{
		for(int OffsetY = -14; OffsetY <= 14; OffsetY += 14)
		{
			if(IsAvoidFreezeAt(Collision, Pos + vec2(Direction * Distance, OffsetY)))
				return true;
		}
	}
	return false;
}
''',
    "Avoid Freeze tile helpers",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "CControls::CControls()\n{\n",
    "CControls::CControls()\n{\n\tm_PixelWalkTick = 0;\n\tmem_zero(&m_aPixelWalk, sizeof(m_aPixelWalk));\n\tmem_zero(&m_aAvoidFreezeOverride, sizeof(m_aAvoidFreezeOverride));\n",
    "PixelWalk constructor initialization",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "void CControls::OnReset()\n{\n\tResetInput(0);",
    "void CControls::OnReset()\n{\n\tm_PixelWalkTick = 0;\n\tResetInput(0);",
    "PixelWalk reset",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "void CControls::ResetInput(int Dummy)\n{\n\tm_aLastData[Dummy].m_Direction = 0;",
    "void CControls::ResetInput(int Dummy)\n{\n\tm_aPixelWalk[Dummy] = 0;\n\tm_aAvoidFreezeOverride[Dummy] = 0;\n\tm_aLastData[Dummy].m_Direction = 0;",
    "PixelWalk input reset",
)
replace_once(
    "src/game/client/components/controls.cpp",
    '''		Console()->Register("+showhookcoll", "", CFGFLAG_CLIENT, ConKeyInputState, &s_State, "Show Hook Collision");
	}

	{
		static CInputSet''',
    '''		Console()->Register("+showhookcoll", "", CFGFLAG_CLIENT, ConKeyInputState, &s_State, "Show Hook Collision");
	}
	{
		static CInputState s_PixelWalk = {this, {&m_aPixelWalk[0], &m_aPixelWalk[1]}, false};
		Console()->Register("+pixelwalk", "", CFGFLAG_CLIENT, ConKeyInputState, &s_PixelWalk, "PixelWalk while held");
	}
	{
		static CInputState s_AvoidFreezeOverride = {this, {&m_aAvoidFreezeOverride[0], &m_aAvoidFreezeOverride[1]}, false};
		Console()->Register("+avoidfreeze_override", "", CFGFLAG_CLIENT, ConKeyInputState, &s_AvoidFreezeOverride, "Temporarily bypass Avoid Freeze while held");
	}

	{
		static CInputSet''',
    "PixelWalk bind command",
)

# Movement assists are applied after normal and dummy input processing, before sending the packet.
replace_once(
    "src/game/client/components/controls.cpp",
    "\t\t// check if we need to send input",
    '''		// PixelWalk: throttle direction updates while its hold-bind is active.
		if(g_Config.m_ClPixelWalk && m_aPixelWalk[g_Config.m_ClDummy] && m_aInputData[g_Config.m_ClDummy].m_Direction != 0)
		{
			const int PixelWalkSpeed = std::clamp(g_Config.m_ClPixelWalkSpeed, 1, 10);
			const int PixelWalkInterval = (10 + PixelWalkSpeed - 1) / PixelWalkSpeed;
			m_PixelWalkTick = (m_PixelWalkTick + 1) % PixelWalkInterval;
			if(m_PixelWalkTick != 0)
				m_aInputData[g_Config.m_ClDummy].m_Direction = 0;
		}
		else
			m_PixelWalkTick = 0;

		// Avoid Freeze: release horizontal movement before entering a freeze tile.
		if(g_Config.m_ClAvoidFreeze && !m_aAvoidFreezeOverride[g_Config.m_ClDummy] &&
			(m_aInputData[g_Config.m_ClDummy].m_PlayerFlags & PLAYERFLAG_PLAYING) &&
			m_aInputData[g_Config.m_ClDummy].m_Direction != 0 &&
			!GameClient()->m_Snap.m_SpecInfo.m_Active)
		{
			const int LocalId = GameClient()->m_aLocalIds[g_Config.m_ClDummy];
			if(LocalId >= 0 && LocalId < MAX_CLIENTS && GameClient()->m_Snap.m_aCharacters[LocalId].m_Active)
			{
				const auto &Character = GameClient()->m_Snap.m_aCharacters[LocalId].m_Cur;
				const vec2 PlayerPos(Character.m_X, Character.m_Y);
				const int Direction = m_aInputData[g_Config.m_ClDummy].m_Direction;
				const int Range = std::clamp(g_Config.m_ClAvoidFreezeRange, 1, 8) * 32;
				if(!IsAvoidFreezeAt(*Collision(), PlayerPos) &&
					IsAvoidFreezeAhead(*Collision(), PlayerPos, Direction, Range))
				{
					m_aInputData[g_Config.m_ClDummy].m_Direction = 0;
				}
			}
		}

		// check if we need to send input''',
    "PixelWalk and Avoid Freeze steering",
)

# Controls menu: make PixelWalk bindable and expose the three assist settings.
replace_once(
    "src/game/client/components/menus_settings_controls.cpp",
    '{EBindOptionGroup::MOVEMENT, Localizable("Toggle ghost"), "toggle cl_race_show_ghost 0 1"},',
    '{EBindOptionGroup::MOVEMENT, Localizable("Toggle ghost"), "toggle cl_race_show_ghost 0 1"},\n\t\t{EBindOptionGroup::MOVEMENT, Localizable("PixelWalk"), "+pixelwalk"},\n\t\t{EBindOptionGroup::MOVEMENT, Localizable("Avoid Freeze Override"), "+avoidfreeze_override"},',
    "PixelWalk bind option",
)
replace_once(
    "src/game/client/components/menus_settings_controls.cpp",
    '''	RenderSettingsBindsBlock(EBindOptionGroup::PRACTICE, &RightColumn, Localize("Practice"));
	RenderSettingsBindsBlock(EBindOptionGroup::MISCELLANEOUS, &RightColumn, Localize("Miscellaneous"));''',
    '''	RenderSettingsBindsBlock(EBindOptionGroup::PRACTICE, &RightColumn, Localize("Practice"));
	RenderSettingsBlock(2.0f * BUTTON_HEIGHT + BUTTON_SPACING, &RightColumn, Localize("PixelWalk"), nullptr, nullptr,
		[&](CUIRect Rect) {
			CUIRect Button;
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			if(GameClient()->m_Menus.DoButton_CheckBox(&g_Config.m_ClPixelWalk, Localize("Enable PixelWalk"), g_Config.m_ClPixelWalk, &Button))
				g_Config.m_ClPixelWalk ^= 1;
			Ui()->DoToolTip(&g_Config.m_ClPixelWalk, &Button, Localize("Enable PixelWalk while holding its bind"));
			Rect.HSplitTop(BUTTON_SPACING, nullptr, &Rect);
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			Ui()->DoScrollbarOption(&g_Config.m_ClPixelWalkSpeed, &g_Config.m_ClPixelWalkSpeed, &Button, Localize("Speed"), 1, 10);
			Ui()->DoToolTip(&g_Config.m_ClPixelWalkSpeed, &Button, Localize("Higher values make PixelWalk movement faster"));
		});
	RenderSettingsBlock(2.0f * BUTTON_HEIGHT + BUTTON_SPACING, &RightColumn, Localize("Dummy Hammer"), nullptr, nullptr,
		[&](CUIRect Rect) {
			CUIRect Button;
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			if(GameClient()->m_Menus.DoButton_CheckBox(&g_Config.m_ClDummyHammerOnW, Localize("Enable Dummy Hammer on W"), g_Config.m_ClDummyHammerOnW, &Button))
				g_Config.m_ClDummyHammerOnW ^= 1;
			Ui()->DoToolTip(&g_Config.m_ClDummyHammerOnW, &Button, Localize("Automatically hammer with Dummy while holding W"));
			Rect.HSplitTop(BUTTON_SPACING, nullptr, &Rect);
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			Ui()->DoScrollbarOption(&g_Config.m_ClDummyHammerWSpeed, &g_Config.m_ClDummyHammerWSpeed, &Button, Localize("Dummy Hammer Speed"), 1, 25);
			Ui()->DoToolTip(&g_Config.m_ClDummyHammerWSpeed, &Button, Localize("Higher values send hammer attempts more frequently; actual hit speed is limited by server reload"));
		});
	RenderSettingsBlock(2.0f * BUTTON_HEIGHT + BUTTON_SPACING, &RightColumn, Localize("Avoid Freeze"), nullptr, nullptr,
		[&](CUIRect Rect) {
			CUIRect Button;
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			if(GameClient()->m_Menus.DoButton_CheckBox(&g_Config.m_ClAvoidFreeze, Localize("Enable Avoid Freeze"), g_Config.m_ClAvoidFreeze, &Button))
				g_Config.m_ClAvoidFreeze ^= 1;
			Ui()->DoToolTip(&g_Config.m_ClAvoidFreeze, &Button, Localize("Stop before freeze tiles; hold Avoid Freeze Override to enter intentionally"));
			Rect.HSplitTop(BUTTON_SPACING, nullptr, &Rect);
			Rect.HSplitTop(BUTTON_HEIGHT, &Button, &Rect);
			Ui()->DoScrollbarOption(&g_Config.m_ClAvoidFreezeRange, &g_Config.m_ClAvoidFreezeRange, &Button, Localize("Avoidance Range"), 1, 8);
			Ui()->DoToolTip(&g_Config.m_ClAvoidFreezeRange, &Button, Localize("How far ahead to check for freeze tiles, in tiles"));
		});
	RenderSettingsBindsBlock(EBindOptionGroup::MISCELLANEOUS, &RightColumn, Localize("Miscellaneous"));''',
    "Controls menu settings blocks",
)

# Final source checks prevent silently producing a client without one of the requested features.
checks = {
    "src/engine/shared/config_variables.h": [
        "cl_pixelwalk", "cl_pixelwalk_speed", "cl_dummy_hammer_w_speed",
        "cl_avoid_freeze", "cl_avoid_freeze_range",
    ],
    "src/game/client/components/controls.cpp": [
        'Console()->Register("+pixelwalk"', 'Console()->Register("+avoidfreeze_override"', "IsAvoidFreezeAhead", "m_aAvoidFreezeOverride", "m_ClAvoidFreeze",
    ],
    "src/game/client/components/menus_settings_controls.cpp": [
        'Localize("PixelWalk")', 'Localize("Dummy Hammer")', 'Localize("Avoid Freeze")',
    ],
    "src/game/client/gameclient.cpp": [
        "ClDummyHammerOnW", "ClDummyHammerWSpeed",
    ],
}
for relative_path, needles in checks.items():
    content = (ROOT / relative_path).read_text(encoding="utf-8")
    missing = [needle for needle in needles if needle not in content]
    if missing:
        raise SystemExit(f"Feature verification failed in {relative_path}: missing {missing}")

print("Applied and verified: W Dummy Hammer, PixelWalk, and Avoid Freeze.")
